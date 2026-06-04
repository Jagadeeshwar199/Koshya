const { normalizeText, applyTypoFixes } = require('../utils/textUtils')
const {
  detectIntent,
  detectClauseIntents,
  MIN_CONFIDENCE
} = require('./intentService')
const { parseWithAI } = require('./aiIntentParser')
const { validateIntent } = require('./intentValidationService')
const pipelineLog = require('../observability/pipelineLogService')
const logger = require('../../utils/logger')
const { setOutboundCapture, clearOutboundCapture } = require('./whatsappService')

const THRESHOLD = MIN_CONFIDENCE

function createContext(userId, rawMessage) {
  return {
    userId,
    rawMessage,
    messageId: null,
    normalized: null,
    stage: 'init'
  }
}

async function stageNormalize(ctx) {
  ctx.stage = 'normalize'
  const t0 = Date.now()
  try {
    ctx.normalized = normalizeText(applyTypoFixes(ctx.rawMessage))
    ctx.messageId = await pipelineLog.logMessage(ctx.userId, ctx.rawMessage, ctx.normalized)
    if (!ctx.messageId) {
      await pipelineLog.logSystemError(
        'logMessage',
        new Error('message_logs_insert_failed'),
        { userId: ctx.userId, rawMessage: ctx.rawMessage }
      )
      logger.error('pipeline.message_log_missing', { userId: ctx.userId })
    }
    logger.info('pipeline.normalize', { userId: ctx.userId, messageId: ctx.messageId, ms: Date.now() - t0 })
    return ctx
  } catch (err) {
    await pipelineLog.logSystemError('normalize', err, { userId: ctx.userId, rawMessage: ctx.rawMessage })
    throw err
  }
}

function detectionLogFields(text) {
  return {
    raw_message: text,
    normalized_message: normalizeText(applyTypoFixes(text))
  }
}

async function stageDetect(ctx, text) {
  ctx.stage = 'detect'
  const t0 = Date.now()
  try {
    const intent = detectIntent(text)
    const ms = Date.now() - t0
    const ok = intent.intent !== 'UNKNOWN' && intent.confidence >= THRESHOLD
    await pipelineLog.logDetection(ctx.messageId, {
      ...detectionLogFields(text),
      intent: intent.intent,
      confidence: intent.confidence,
      entities: intent.entities,
      success: ok,
      failure_reason: ok ? null : 'low_confidence_or_unknown',
      processing_time_ms: ms
    })
    logger.info('pipeline.detect', { messageId: ctx.messageId, intent: intent.intent, confidence: intent.confidence, ms })
    return intent
  } catch (err) {
    await pipelineLog.logDetection(ctx.messageId, {
      ...detectionLogFields(text),
      intent: 'ERROR',
      confidence: 0,
      entities: {},
      success: false,
      failure_reason: err.message,
      processing_time_ms: Date.now() - t0
    })
    await pipelineLog.logSystemError('detect', err, { messageId: ctx.messageId, text })
    throw err
  }
}

async function stageAI(ctx, intent, text) {
  ctx.stage = 'ai_fallback'
  if (intent.confidence >= THRESHOLD) return intent
  try {
    const ai = await parseWithAI({
      rawMessage: ctx.rawMessage,
      normalized: ctx.normalized,
      deterministic: intent
    })
    await pipelineLog.logAI(ctx.messageId, ai)
    logger.info('pipeline.ai_fallback', { messageId: ctx.messageId, success: ai.success, reason: ai.failure_reason })
    if (ai.success && ai.ai_intent && Number(ai.confidence) >= THRESHOLD) {
      return { ...intent, intent: ai.ai_intent, confidence: Number(ai.confidence), rawText: intent.rawText || text, entities: intent.entities, source: 'ai' }
    }
    return intent
  } catch (err) {
    await pipelineLog.logAI(ctx.messageId, {
      raw_message: ctx.rawMessage,
      normalized_message: ctx.normalized,
      prompt_sent: null,
      success: false,
      failure_reason: err.message
    })
    await pipelineLog.logSystemError('ai_fallback', err, { messageId: ctx.messageId })
    return intent
  }
}

async function stageValidate(ctx, intent, text) {
  ctx.stage = 'validate'
  try {
    const { passed, error } = validateIntent(intent, text)
    await pipelineLog.logValidation(ctx.messageId, intent.intent, passed, error)
    logger.info('pipeline.validate', { messageId: ctx.messageId, intent: intent.intent, passed, error })
    return { passed, error }
  } catch (err) {
    await pipelineLog.logValidation(ctx.messageId, intent?.intent || 'ERROR', false, err.message)
    await pipelineLog.logSystemError('validate', err, { messageId: ctx.messageId })
    throw err
  }
}

async function stageExecute(ctx, actionType, fn) {
  if (!ctx?.messageId) return fn()
  ctx.stage = 'execute'
  const t0 = Date.now()
  try {
    const result = await fn()
    const ms = Date.now() - t0
    const ok = result?.ok !== false && !result?.error
    await pipelineLog.logExecution(ctx.messageId, actionType, ok, result?.error || null, ms)
    logger.info('pipeline.execute', { messageId: ctx.messageId, actionType, ok, ms })
    return result
  } catch (err) {
    await pipelineLog.logExecution(ctx.messageId, actionType, false, err.message, Date.now() - t0)
    await pipelineLog.logSystemError('execute', err, { messageId: ctx.messageId, actionType })
    throw err
  }
}

async function processClause(ctx, text, executeFn) {
  let intent = await stageDetect(ctx, text)
  intent = await stageAI(ctx, intent, text)
  const validation = await stageValidate(ctx, intent, text)
  if (!validation.passed) {
    return executeFn(intent, { validationFailed: true, validationError: validation.error })
  }
  return stageExecute(ctx, intent.intent, () => executeFn(intent, {}))
}

async function runPipeline(userId, rawMessage, routeFn) {
  const ctx = createContext(userId, rawMessage)
  const responses = []
  if (setOutboundCapture) setOutboundCapture((t) => responses.push(t))
  try {
    await stageNormalize(ctx)
    return await routeFn(ctx)
  } catch (err) {
    await pipelineLog.logSystemError(ctx.stage || 'pipeline', err, {
      userId,
      rawMessage,
      messageId: ctx.messageId
    })
    throw err
  } finally {
    clearOutboundCapture?.()
  }
}

module.exports = {
  runPipeline,
  processClause,
  stageNormalize,
  stageDetect,
  stageAI,
  stageValidate,
  stageExecute,
  createContext,
  THRESHOLD
}
