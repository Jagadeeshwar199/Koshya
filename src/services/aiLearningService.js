const supabase = require('../../config/supabase')
const { toLegacyIntent } = require('../detection/intentAdapter')
const pipelineLog = require('../observability/pipelineLogService')
const logger = require('../../utils/logger')

const EXAMPLE_LIMIT = 5

function domainActionToIntent(domain, action, entities, message, confidence) {
  const legacy = toLegacyIntent({
    domain,
    action,
    entities: entities || {},
    message,
    score: confidence,
    usedAI: true
  })
  return { intent: legacy.intent, entities: legacy.entities }
}

function normalizeGeminiResult(rawMessage, gemini) {
  if (gemini.ai_intent) {
    return {
      intent: gemini.ai_intent,
      entities: gemini.entities || {},
      confidence: gemini.ai_confidence ?? gemini.confidence
    }
  }
  if (gemini.domain && gemini.action) {
    const mapped = domainActionToIntent(
      gemini.domain,
      gemini.action,
      gemini.entities,
      rawMessage,
      gemini.confidence
    )
    return { intent: mapped.intent, entities: mapped.entities, confidence: gemini.confidence }
  }
  return { intent: null, entities: {}, confidence: gemini.confidence ?? null }
}

async function recordAIFallback(messageId, rawMessage, geminiResult, extra = {}) {
  if (!messageId || !geminiResult) return null
  if (geminiResult.failure_reason === 'ai_disabled' || geminiResult.failure_reason === 'missing_gemini_api_key') {
    return null
  }
  const mapped = normalizeGeminiResult(rawMessage, geminiResult)
  const row = {
    message: rawMessage,
    intent: mapped.intent,
    entities: mapped.entities,
    confidence: mapped.confidence,
    used_ai: true,
    raw_message: rawMessage,
    normalized_message: extra.normalized_message ?? rawMessage,
    model: geminiResult.model ?? null,
    prompt_sent: geminiResult.prompt_sent ?? null,
    ai_response: geminiResult.ai_response ?? null,
    ai_intent: mapped.intent,
    ai_confidence: mapped.confidence,
    token_usage: geminiResult.token_usage ?? null,
    success: geminiResult.success === true && !!mapped.intent,
    failure_reason: geminiResult.failure_reason ?? null,
    error_message: geminiResult.error_message ?? null
  }
  const id = await pipelineLog.logAI(messageId, row)
  logger.info('AI_FALLBACK', {
    message_id: messageId,
    message: rawMessage,
    intent: mapped.intent,
    confidence: mapped.confidence,
    success: row.success
  })
  return { id, ...row }
}

async function queryLearningRows() {
  const { data, error } = await supabase
    .from('ai_detection_logs')
    .select('message, intent, entities, confidence, created_at')
    .eq('used_ai', true)
  if (error) throw error
  return (data || []).filter((r) => r.intent)
}

async function getAIFallbackCountByIntent() {
  const rows = await queryLearningRows()
  const counts = {}
  for (const r of rows) {
    const k = r.intent || 'UNKNOWN'
    counts[k] = (counts[k] || 0) + 1
  }
  return Object.entries(counts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
}

async function getTopAIFallbackIntents(limit = 10) {
  const all = await getAIFallbackCountByIntent()
  return all.slice(0, limit)
}

async function getRecentAIFallbackMessages(limit = 50) {
  const { data, error } = await supabase
    .from('ai_detection_logs')
    .select('message, intent, entities, confidence, created_at')
    .eq('used_ai', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

async function buildAILearningAdminReport() {
  const byIntent = await getAIFallbackCountByIntent()
  const lines = ['🧠 AI Learning Loop (collect only — no auto-rules)']
  if (!byIntent.length) return `${lines[0]}\n(none yet)`

  for (const { intent, count } of byIntent) {
    const { data } = await supabase
      .from('ai_detection_logs')
      .select('message')
      .eq('used_ai', true)
      .eq('intent', intent)
      .order('created_at', { ascending: false })
      .limit(EXAMPLE_LIMIT)
    lines.push('', `${intent} (${count})`)
    for (const row of data || []) {
      lines.push(`• ${String(row.message || '').slice(0, 120)}`)
    }
  }
  return lines.join('\n')
}

module.exports = {
  recordAIFallback,
  getTopAIFallbackIntents,
  getRecentAIFallbackMessages,
  getAIFallbackCountByIntent,
  buildAILearningAdminReport,
  domainActionToIntent
}
