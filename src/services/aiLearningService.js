const supabase = require('../../config/supabase')
const pipelineLog = require('../observability/pipelineLogService')
const logger = require('../../utils/logger')

const EXAMPLE_LIMIT = 5

function assertAiLearningRow(messageId, row) {
  if (row.used_ai !== true) return
  const prompt = String(row.prompt_sent || '').trim()
  const model = String(row.model || '').trim()
  if (!prompt || !model) {
    logger.error('ai_learning.used_ai_missing_prompt', {
      message_id: messageId,
      prompt_sent: row.prompt_sent,
      model: row.model
    })
  }
}

async function recordDetectionLearning(messageId, row) {
  if (!messageId || !row?.message) return null
  assertAiLearningRow(messageId, row)
  const intentVal = row.final_intent ?? row.intent
  const payload = {
    message: row.message,
    rule_intent: row.rule_intent ?? null,
    rule_confidence: row.rule_confidence ?? null,
    final_intent: intentVal,
    intent: intentVal,
    entities: row.entities || {},
    confidence: row.confidence ?? null,
    used_ai: row.used_ai === true,
    gemini_response: row.gemini_response ?? null,
    response_sent: row.response_sent ?? null,
    raw_message: row.message,
    normalized_message: row.normalized_message ?? row.message,
    success: !!intentVal,
    model: row.model ?? null,
    prompt_sent: row.prompt_sent ?? null,
    ai_response: row.ai_response ?? null,
    ai_intent: row.ai_intent ?? null,
    ai_confidence: row.confidence != null ? row.confidence / 100 : null,
    token_usage: row.token_usage ?? null,
    failure_reason: row.failure_reason ?? null
  }
  const id = await pipelineLog.logAI(messageId, payload)
  logger.info('AI_LEARNING_COLLECT', {
    message_id: messageId,
    used_ai: row.used_ai,
    rule_intent: row.rule_intent,
    final_intent: row.final_intent,
    ai_intent: row.ai_intent,
    confidence: row.confidence,
    has_response: !!(row.response_sent || row.gemini_response),
    has_prompt: !!String(row.prompt_sent || '').trim()
  })
  return id
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
  const { data, error } = await supabase.from('ai_detection_logs').select('final_intent').eq('used_ai', true)
  if (error) throw error
  const counts = {}
  for (const r of data || []) {
    const k = r.final_intent || 'UNKNOWN'
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
    .select('message, rule_intent, final_intent, entities, confidence, gemini_response, response_sent, used_ai, created_at')
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
  const lines = ['🧠 AI Learning Mode (30d collect)', `AI rows: ${await countAIUsage()}`]
  if (!byIntent.length) return `${lines.join('\n')}\n(none)`
  for (const { intent, count } of byIntent) {
    const { data } = await supabase
      .from('ai_detection_logs')
      .select('message, response_sent')
      .eq('used_ai', true)
      .eq('final_intent', intent)
      .order('created_at', { ascending: false })
      .limit(EXAMPLE_LIMIT)
    lines.push('', `${intent} (${count})`)
    for (const row of data || []) lines.push(`• ${String(row.message || '').slice(0, 100)}`)
  }
  return lines.join('\n')
}

module.exports = {
  recordDetectionLearning,
  assertAiLearningRow,
  countAIUsage,
  getTopAIFallbackIntents,
  getRecentAIFallbackMessages,
  getAIFallbackCountByIntent,
  buildAILearningAdminReport
}
