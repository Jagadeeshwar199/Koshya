const supabase = require('../../config/supabase')
const logger = require('../../utils/logger')

const ACTION_STAGE = {
  REMINDER_CREATE: 'REMINDER_CREATED',
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATED',
  REMINDER_UPDATE: 'DATABASE_WRITE',
  REMINDER_RESCHEDULE: 'DATABASE_WRITE',
  REMINDER_CANCEL: 'DATABASE_WRITE'
}

async function logExecution({
  requestId,
  userId,
  phoneNumber,
  messageId,
  stage,
  status = 'INFO',
  event,
  input,
  output,
  duration = 0,
  error,
  stack
}) {
  if (!requestId || !stage) return null
  try {
    const row = {
      request_id: requestId,
      user_id: userId || phoneNumber || null,
      phone_number: phoneNumber || userId || null,
      message_id: messageId || null,
      stage,
      event: event || stage,
      status,
      input_data: input ?? null,
      output_data: stack ? { ...(output || {}), stack } : output ?? null,
      processing_time_ms: duration || 0,
      error_message: error || null
    }
    const { data, error: err } = await supabase.from('execution_logs').insert(row).select('id')
    if (err) {
      logger.error('execution_log.insert_failed', { stage, error: err.message })
      return null
    }
    return data?.[0]?.id || null
  } catch (err) {
    logger.error('execution_log.insert_exception', { stage, error: err.message })
    return null
  }
}

function fields(ctx) {
  return {
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    phoneNumber: ctx?.userId,
    messageId: ctx?.whatsappMessageId || ctx?.messageId || null
  }
}

async function logMessage(ctx, rawMessage, normalizedMessage) {
  return logExecution({
    ...fields(ctx),
    stage: 'NORMALIZATION',
    status: 'SUCCESS',
    event: 'normalize',
    input: { raw_message: rawMessage },
    output: { normalized_message: normalizedMessage }
  })
}

async function logDetection(ctx, payload) {
  return logExecution({
    ...fields(ctx),
    stage: 'INTENT_DETECTION',
    status: payload.success !== false ? 'SUCCESS' : 'WARNING',
    event: payload.intent || payload.detected_intent,
    input: { raw_message: payload.raw_message, normalized_message: payload.normalized_message },
    output: {
      intent: payload.intent,
      confidence: payload.confidence,
      entities: payload.entities || payload.extracted_entities,
      domain: payload.domain,
      action: payload.action,
      used_ai: payload.used_ai,
      planner_decision: payload.planner_decision,
      match_details: payload.match_details
    },
    duration: payload.processing_time_ms || 0,
    error: payload.failure_reason
  })
}

async function logShadowDetection(messageIdOrCtx, result, ms = 0, pipeline = 'shadow') {
  const ctx =
    typeof messageIdOrCtx === 'object'
      ? messageIdOrCtx
      : { requestId: messageIdOrCtx, whatsappMessageId: messageIdOrCtx }
  return logDetection(ctx, {
    pipeline,
    intent: pipeline === 'primary' ? `${result.domain}:${result.action}` : `SHADOW:${result.domain}:${result.action}`,
    confidence: result.score,
    entities: result.entities,
    success: result.canExecute,
    processing_time_ms: ms,
    failure_reason: result.canExecute ? null : 'shadow_not_executable'
  })
}

async function logAI(ctx, payload) {
  return logExecution({
    ...fields(typeof ctx === 'object' ? ctx : { requestId: ctx }),
    stage: 'AI_CLASSIFICATION',
    status: payload.success === false ? 'ERROR' : 'SUCCESS',
    event: payload.final_intent || payload.ai_intent || payload.intent,
    input: { raw_message: payload.raw_message, prompt_sent: payload.prompt_sent },
    output: {
      rule_intent: payload.rule_intent,
      final_intent: payload.final_intent ?? payload.intent,
      ai_intent: payload.ai_intent,
      entities: payload.entities,
      confidence: payload.confidence,
      used_ai: payload.used_ai === true,
      model: payload.model,
      token_usage: payload.token_usage,
      gemini_response: payload.gemini_response,
      response_sent: payload.response_sent
    },
    error: payload.error_message || payload.failure_reason
  })
}

async function logValidation(ctx, intent, passed, error) {
  return logExecution({
    ...fields(ctx),
    stage: 'VALIDATION',
    status: passed ? 'SUCCESS' : 'WARNING',
    event: intent,
    output: { validation_passed: passed, validation_error: error || null }
  })
}

async function logExecutionAction(ctx, actionType, success, errorMessage, executionTimeMs) {
  const stage = ACTION_STAGE[actionType] || 'ACTION_SELECTION'
  return logExecution({
    ...fields(ctx),
    stage,
    status: success !== false ? 'SUCCESS' : 'ERROR',
    event: actionType,
    output: { action_type: actionType, success: success !== false },
    duration: executionTimeMs || 0,
    error: errorMessage
  })
}

async function logSystemError(stage, err, requestPayload) {
  await supabase.from('system_errors').insert({
    stage,
    error_message: err?.message || String(err),
    stack_trace: err?.stack || null,
    request_payload: requestPayload || null
  })
  if (requestPayload?.requestId) {
    await logExecution({
      requestId: requestPayload.requestId,
      userId: requestPayload.userId,
      phoneNumber: requestPayload.userId,
      messageId: requestPayload.whatsappMessageId,
      stage: 'FAILED',
      status: 'ERROR',
      event: stage,
      input: requestPayload,
      error: err?.message || String(err),
      stack: err?.stack
    })
  }
}

module.exports = {
  logExecution,
  logMessage,
  logDetection,
  logShadowDetection,
  logAI,
  logValidation,
  logExecutionAction,
  logSystemError
}
