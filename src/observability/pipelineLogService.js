const supabase = require('../../config/supabase')
const logger = require('../../utils/logger')

async function safeInsert(table, row) {
  try {
    const { data, error } = await supabase.from(table).insert(row).select('id')
    if (error) {
      logger.error('pipeline_log.insert_failed', {
        table,
        error: error.message,
        code: error.code,
        hint: error.hint
      })
      return null
    }
    return data?.[0]?.id || null
  } catch (err) {
    logger.error('pipeline_log.insert_exception', { table, error: err.message })
    return null
  }
}

async function logMessage(userId, rawMessage, normalizedMessage) {
  return safeInsert('message_logs', {
    user_id: userId,
    raw_message: rawMessage,
    normalized_message: normalizedMessage
  })
}

async function logDetection(messageId, payload) {
  if (!messageId) return null
  return safeInsert('detection_logs', {
    message_id: messageId,
    raw_message: payload.raw_message ?? null,
    normalized_message: payload.normalized_message ?? null,
    detected_intent: payload.intent,
    confidence: payload.confidence,
    extracted_entities: payload.entities || {},
    success: payload.success !== false,
    failure_reason: payload.failure_reason || null,
    processing_time_ms: payload.processing_time_ms || 0
  })
}

async function logAI(messageId, payload) {
  if (!messageId) return null
  return safeInsert('ai_detection_logs', {
    message_id: messageId,
    raw_message: payload.raw_message ?? null,
    normalized_message: payload.normalized_message ?? null,
    model: payload.model ?? null,
    prompt_sent: payload.prompt_sent || null,
    ai_response: payload.ai_response || null,
    ai_intent: payload.ai_intent || null,
    ai_confidence: payload.ai_confidence ?? payload.confidence ?? null,
    confidence: payload.confidence ?? null,
    token_usage: payload.token_usage || null,
    success: payload.success === true,
    error_message: payload.error_message ?? payload.failure_reason ?? null,
    failure_reason: payload.failure_reason || null
  })
}

async function logValidation(messageId, intent, passed, error) {
  if (!messageId) return null
  return safeInsert('validation_logs', {
    message_id: messageId,
    intent,
    validation_passed: passed,
    validation_error: error || null
  })
}

async function logExecution(messageId, actionType, success, errorMessage, executionTimeMs) {
  if (!messageId) return null
  return safeInsert('execution_logs', {
    message_id: messageId,
    action_type: actionType,
    success: success !== false,
    error_message: errorMessage || null,
    execution_time_ms: executionTimeMs || 0
  })
}

async function logSystemError(stage, err, requestPayload) {
  return safeInsert('system_errors', {
    stage,
    error_message: err?.message || String(err),
    stack_trace: err?.stack || null,
    request_payload: requestPayload || null
  })
}

module.exports = {
  logMessage,
  logDetection,
  logAI,
  logValidation,
  logExecution,
  logSystemError
}
