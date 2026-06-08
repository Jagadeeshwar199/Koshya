/**
 * Analytics — classification/logging only; never blocks execution.
 */
const pipelineLog = require('../observability/pipelineLogService')
const detectionAnalytics = require('../services/detectionAnalyticsService')
const { normalizeEvent } = require('./normalizer')

function classifyEventType(parseResult) {
  const domain = parseResult?.domain || 'UNKNOWN'
  const action = parseResult?.action || 'UNKNOWN'
  return `${domain}:${action}`
}

function executionResultLabel(result) {
  if (!result) return 'none'
  if (result.cancelled) return 'cancelled'
  if (result.ok === false) return 'failure'
  if (result.ok === true) return 'success'
  return 'unknown'
}

async function logExecution(ctx, { rawMessage, parseResult, result, failureReason = null }) {
  const normalized_event = normalizeEvent(parseResult)
  const record = {
    raw_message: rawMessage,
    normalized_event,
    predicted_event_type: classifyEventType(parseResult),
    confidence: normalized_event.confidence,
    execution_result: executionResultLabel(result),
    failure_reason: failureReason || parseResult?.failure_reason || null,
    parser_used: parseResult?.parser_used !== false,
    ai_used: parseResult?.ai_used === true
  }

  if (record.execution_result === 'success') detectionAnalytics.recordExecution()
  else if (record.failure_reason) detectionAnalytics.recordClarification(rawMessage)

  if (ctx?.messageId) {
    await pipelineLog.logDetection(ctx.messageId, {
      pipeline: 'core',
      raw_message: record.raw_message,
      normalized_message: normalized_event.message,
      intent: parseResult?.intent || null,
      confidence: record.confidence,
      entities: parseResult?.entities || {},
      success: record.execution_result === 'success',
      failure_reason: record.failure_reason,
      predicted_event_type: record.predicted_event_type,
      parser_used: record.parser_used,
      ai_used: record.ai_used,
      processing_time_ms: null
    }).catch(() => {})
  }

  return record
}

module.exports = { logExecution, classifyEventType, executionResultLabel }
