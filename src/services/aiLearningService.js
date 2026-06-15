const supabase = require('../../config/supabase')
const pipelineLog = require('../observability/pipelineLogService')
const logger = require('../../utils/logger')

const EXAMPLE_LIMIT = 5
const AI_STAGE = 'AI_CLASSIFICATION'

function assertAiLearningRow(ctx, row) {
  if (row.used_ai !== true) return
  const prompt = String(row.prompt_sent || '').trim()
  const model = String(row.model || '').trim()
  if (!prompt || !model) {
    logger.error('ai_learning.used_ai_missing_prompt', {
      request_id: ctx?.requestId,
      prompt_sent: row.prompt_sent,
      model: row.model
    })
  }
}

async function recordDetectionLearning(ctx, row) {
  if (!ctx?.requestId || !row?.message) return null
  assertAiLearningRow(ctx, row)
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
  const id = await pipelineLog.logAI(ctx, payload)
  logger.info('AI_LEARNING_COLLECT', {
    request_id: ctx.requestId,
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

function aiRows(data) {
  return (data || []).filter((r) => r.output_data?.used_ai === true)
}

async function countAIUsage() {
  const { data, error } = await supabase.from('execution_logs').select('output_data').eq('stage', AI_STAGE)
  if (error) throw error
  return aiRows(data).length
}

async function getTopAIFallbackIntents(limit = 10) {
  const { data, error } = await supabase.from('execution_logs').select('output_data').eq('stage', AI_STAGE)
  if (error) throw error
  const counts = {}
  for (const r of aiRows(data)) {
    const k = r.output_data?.final_intent || 'UNKNOWN'
    counts[k] = (counts[k] || 0) + 1
  }
  return Object.entries(counts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

async function getRecentAIFallbackMessages(limit = 50) {
  const { data, error } = await supabase
    .from('execution_logs')
    .select('input_data, output_data, created_at')
    .eq('stage', AI_STAGE)
    .order('created_at', { ascending: false })
    .limit(limit * 3)
  if (error) throw error
  return aiRows(data)
    .slice(0, limit)
    .map((r) => ({
      message: r.input_data?.raw_message,
      rule_intent: r.output_data?.rule_intent,
      final_intent: r.output_data?.final_intent,
      entities: r.output_data?.entities,
      confidence: r.output_data?.confidence,
      gemini_response: r.output_data?.gemini_response,
      response_sent: r.output_data?.response_sent,
      used_ai: r.output_data?.used_ai,
      created_at: r.created_at
    }))
}

async function getAIFallbackCountByIntent() {
  return getTopAIFallbackIntents(100)
}

async function buildAILearningAdminReport() {
  const byIntent = await getTopAIFallbackIntents(20)
  const lines = ['🧠 AI Learning Mode (30d collect)', `AI rows: ${await countAIUsage()}`]
  if (!byIntent.length) return `${lines.join('\n')}\n(none)`
  const { data } = await supabase
    .from('execution_logs')
    .select('input_data, output_data, created_at')
    .eq('stage', AI_STAGE)
    .order('created_at', { ascending: false })
    .limit(500)
  for (const { intent, count } of byIntent) {
    const examples = aiRows(data)
      .filter((r) => r.output_data?.final_intent === intent)
      .slice(0, EXAMPLE_LIMIT)
    lines.push('', `${intent} (${count})`)
    for (const row of examples) lines.push(`• ${String(row.input_data?.raw_message || '').slice(0, 100)}`)
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
