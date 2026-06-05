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
    pipeline: payload.pipeline || 'legacy',
    message: payload.message ?? payload.raw_message ?? null,
    raw_message: payload.raw_message ?? null,
    normalized_message: payload.normalized_message ?? null,
    detected_intent: payload.intent,
    confidence: payload.confidence,
    extracted_entities: payload.entities || {},
    success: payload.success !== false,
    failure_reason: payload.failure_reason || null,
    processing_time_ms: payload.processing_time_ms || 0,
    match_details: payload.match_details ?? null,
    domain: payload.domain ?? null,
    action: payload.action ?? null,
    score: payload.score ?? null,
    can_execute: payload.can_execute ?? null,
    used_ai: payload.used_ai === true,
    planner_decision: payload.planner_decision ?? null
  })
}

async function logAI(messageId, payload) {
  if (!messageId) return null
  const usedAi = payload.used_ai === true
  return safeInsert('ai_detection_logs', {
    message_id: messageId,
    message: payload.message ?? payload.raw_message ?? null,
    rule_intent: payload.rule_intent ?? null,
    rule_confidence: payload.rule_confidence ?? null,
    final_intent: payload.final_intent ?? payload.intent ?? payload.ai_intent ?? null,
    intent: payload.final_intent ?? payload.intent ?? payload.ai_intent ?? null,
    entities: payload.entities || payload.extracted_entities || {},
    confidence: payload.confidence ?? (payload.ai_confidence != null ? payload.ai_confidence * 100 : null),
    used_ai: usedAi,
    raw_message: payload.raw_message ?? payload.message ?? null,
    normalized_message: payload.normalized_message ?? null,
    model: payload.model ?? null,
    prompt_sent: payload.prompt_sent || null,
    ai_response: payload.ai_response || null,
    ai_intent: payload.ai_intent ?? payload.intent ?? null,
    ai_confidence: payload.ai_confidence ?? payload.confidence ?? null,
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

function primaryDetectionRow(result, ms, pipeline) {
  const intentLabel = `${result.domain}:${result.action}`
  const rejected = result.decision === 'REJECTED_LOW_SCORE'
  return {
    pipeline,
    message: result.message,
    raw_message: result.message,
    normalized_message: result.message,
    domain: result.domain,
    action: result.action,
    score: result.scorePercent ?? Math.round((result.score || 0) * 100),
    detected_intent: rejected ? 'REJECTED_LOW_SCORE' : intentLabel,
    confidence: result.score,
    extracted_entities: result.entities || {},
    reasons: result.reasons || [],
    can_execute: result.canExecute === true,
    missing_fields: result.missingFields || [],
    used_ai: result.usedAI === true,
    planner_decision: result.plannerDecision || result.decision,
    success: result.decision === 'EXECUTE',
    failure_reason: rejected ? 'REJECTED_LOW_SCORE' : result.canExecute ? null : result.decision,
    processing_time_ms: ms,
    match_details: result.rejectionLog || result.match_details || {
      winner: result.winner,
      planner_decision: result.plannerDecision,
      decision: result.decision,
      used_ai: result.usedAI === true,
      can_execute: result.canExecute === true
    }
  }
}

async function logShadowDetection(messageId, result, ms = 0, pipeline = 'shadow') {
  if (!messageId || !result) return null
  const row =
    pipeline === 'primary'
      ? primaryDetectionRow(result, ms, pipeline)
      : {
          message_id: messageId,
          pipeline,
          message: result.message,
          raw_message: result.message,
          normalized_message: result.message,
          domain: result.domain,
          action: result.action,
          score: result.score,
          detected_intent: `SHADOW:${result.domain}:${result.action}`,
          confidence: result.score,
          extracted_entities: result.entities || {},
          reasons: result.reasons || [],
          can_execute: result.canExecute,
          missing_fields: result.missingFields || [],
          used_ai: result.usedAI === true,
          planner_decision: result.plannerDecision || result.decision,
          success: result.canExecute,
          failure_reason: result.canExecute ? null : 'shadow_not_executable',
          processing_time_ms: ms
        }
  if (pipeline === 'primary') {
    return safeInsert('detection_logs', { message_id: messageId, ...row })
  }
  return safeInsert('detection_logs', { message_id: messageId, ...row })
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
  logShadowDetection,
  logAI,
  logValidation,
  logExecution,
  logSystemError
}
