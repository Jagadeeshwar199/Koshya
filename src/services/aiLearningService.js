const supabase = require('../../config/supabase')
const { toLegacyIntent } = require('../detection/intentAdapter')
const pipelineLog = require('../observability/pipelineLogService')
const logger = require('../../utils/logger')

const EXAMPLE_LIMIT = 5

function domainActionToIntent(domain, action, entities, message, confidence) {
  const legacy = toLegacyIntent({ domain, action, entities: entities || {}, message, score: confidence, usedAI: true })
  return { intent: legacy.intent, entities: legacy.entities }
}

function normalizeGemini(gemini, rawMessage) {
  if (gemini.ai_intent) {
    return {
      final_intent: gemini.ai_intent,
      entities: gemini.entities || {},
      confidence: Math.round((gemini.ai_confidence ?? gemini.confidence ?? 0) * 100)
    }
  }
  if (gemini.domain && gemini.action) {
    const m = domainActionToIntent(gemini.domain, gemini.action, gemini.entities, rawMessage, gemini.confidence)
    return { final_intent: m.intent, entities: m.entities, confidence: Math.round((gemini.confidence || 0) * 100) }
  }
  return { final_intent: null, entities: {}, confidence: null }
}

async function recordDetectionLearning(messageId, row) {
  if (!messageId || !row?.message) return null
  const payload = {
    message: row.message,
    rule_intent: row.rule_intent,
    rule_confidence: row.rule_confidence,
    final_intent: row.final_intent,
    intent: row.final_intent,
    entities: row.entities || {},
    confidence: row.confidence,
    used_ai: row.used_ai === true,
    raw_message: row.message,
    normalized_message: row.normalized_message ?? row.message,
    success: !!row.final_intent,
    model: row.model ?? null,
    prompt_sent: row.prompt_sent ?? null,
    ai_response: row.ai_response ?? null,
    ai_intent: row.final_intent,
    ai_confidence: row.confidence != null ? row.confidence / 100 : null,
    token_usage: row.token_usage ?? null,
    failure_reason: row.failure_reason ?? null
  }
  const id = await pipelineLog.logAI(messageId, payload)
  logger.info(row.used_ai ? 'AI_FALLBACK' : 'RULE_MATCH', {
    message_id: messageId,
    message: row.message,
    rule_intent: row.rule_intent,
    rule_confidence: row.rule_confidence,
    final_intent: row.final_intent,
    confidence: row.confidence,
    used_ai: row.used_ai
  })
  return { id, ...payload }
}

async function recordAIFallback(messageId, rawMessage, geminiResult, extra = {}) {
  if (geminiResult?.failure_reason === 'ai_disabled' || geminiResult?.failure_reason === 'missing_gemini_api_key') {
    return null
  }
  const g = normalizeGemini(geminiResult, rawMessage)
  return recordDetectionLearning(messageId, {
    message: rawMessage,
    rule_intent: extra.rule_intent ?? 'UNKNOWN',
    rule_confidence: extra.rule_confidence ?? 0,
    final_intent: g.final_intent,
    entities: g.entities,
    confidence: g.confidence,
    used_ai: true,
    normalized_message: extra.normalized_message,
    model: geminiResult.model,
    prompt_sent: geminiResult.prompt_sent,
    ai_response: geminiResult.ai_response,
    token_usage: geminiResult.token_usage,
    failure_reason: geminiResult.failure_reason
  })
}

async function countAIUsage() {
  const { count, error } = await supabase
    .from('ai_detection_logs')
    .select('*', { count: 'exact', head: true })
    .eq('used_ai', true)
  if (error) throw error
  return count || 0
}

async function getTopAIFallbackIntents(limit = 10) {
  const { data, error } = await supabase
    .from('ai_detection_logs')
    .select('final_intent')
    .eq('used_ai', true)
  if (error) throw error
  const counts = {}
  for (const r of data || []) {
    const k = r.final_intent || r.intent || 'UNKNOWN'
    counts[k] = (counts[k] || 0) + 1
  }
  return Object.entries(counts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

async function getRecentAIFallbackMessages(limit = 50) {
  const { data, error } = await supabase
    .from('ai_detection_logs')
    .select('message, rule_intent, rule_confidence, final_intent, entities, confidence, used_ai, created_at')
    .eq('used_ai', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

async function getAIFallbackCountByIntent() {
  return getTopAIFallbackIntents(100)
}

async function buildAILearningAdminReport() {
  const byIntent = await getTopAIFallbackIntents(20)
  const lines = ['🧠 AI threshold learning (collect only)', `AI calls: ${await countAIUsage()}`]
  if (!byIntent.length) return `${lines.join('\n')}\n(none yet)`
  for (const { intent, count } of byIntent) {
    const { data } = await supabase
      .from('ai_detection_logs')
      .select('message')
      .eq('used_ai', true)
      .eq('final_intent', intent)
      .order('created_at', { ascending: false })
      .limit(EXAMPLE_LIMIT)
    lines.push('', `${intent} (${count})`)
    for (const row of data || []) lines.push(`• ${String(row.message || '').slice(0, 120)}`)
  }
  return lines.join('\n')
}

module.exports = {
  recordDetectionLearning,
  recordAIFallback,
  countAIUsage,
  getTopAIFallbackIntents,
  getRecentAIFallbackMessages,
  getAIFallbackCountByIntent,
  buildAILearningAdminReport
}
