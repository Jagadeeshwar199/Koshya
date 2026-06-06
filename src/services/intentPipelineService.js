const { normalizeText, applyTypoFixes } = require('../utils/textUtils')
const {
  detectIntent,
  MIN_CONFIDENCE
} = require('./intentService')
const { parseWithAI } = require('./aiIntentParser')
const { validateIntent } = require('./intentValidationService')
const pipelineLog = require('../observability/pipelineLogService')
const { isLegacyIntentEngineEnabled } = require('../config/constants')
const { isLegacyRuleExecutable, RouteSource } = require('../detection/intentRouting')
const {
  detectAndPlan,
  useLegacyEngine,
  Decision
} = require('../detection/detectionEngine')
const logger = require('../../utils/logger')
const { setOutboundCapture, clearOutboundCapture, sendWhatsAppMessage, setActiveReplyMessageId, clearActiveReplyMessageId } = require('./whatsappService')
const { buildKoshyaResponse } = require('./koshyaResponseLayer')

async function deliverKoshyaAiResponse(ctx, intent, det, execResult, validation) {
  const geminiRaw = det?.geminiResponse || ctx.geminiResponse || null
  const { text, geminiStored } = buildKoshyaResponse({
    intent: intent.intent,
    entities: intent.entities,
    geminiRaw,
    execResult,
    validationOk: validation.passed && execResult?.ok !== false
  })
  ctx.geminiRawForLog = geminiStored
  if (text && !execResult?.replySent) {
    const reply = await sendWhatsAppMessage(ctx.userId, text)
    if (reply.success && !reply.duplicateBlocked) {
      ctx.capturedResponses = [...(ctx.capturedResponses || []), text]
    }
  }
  ctx.koshyaResponseSent = ctx.capturedResponses?.[ctx.capturedResponses.length - 1] || text || null
}

function logRouting(event, payload) {
  logger.info(event, payload)
}

const THRESHOLD = MIN_CONFIDENCE

function logParserDetection(payload) {
  return require('./parserTelemetryService').logParserDetection(payload)
}

function matchedRule(intent) {
  const matches = intent?.match_details?.matches
  if (!matches?.length) return null
  const hit = matches.find((m) => m.rule && m.rule !== intent.intent)
  return hit?.rule || matches[0].rule || null
}

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

async function logDetectionRow(ctx, text, payload, ms, pipeline) {
  await pipelineLog.logDetection(ctx.messageId, {
    pipeline,
    ...detectionLogFields(text),
    ...payload,
    processing_time_ms: ms
  })
}

async function stageDetectLegacy(ctx, text) {
  const t0 = Date.now()
  const intent = detectIntent(text)
  const ms = Date.now() - t0
  const ok = intent.intent !== 'UNKNOWN' && intent.confidence >= THRESHOLD
  await logDetectionRow(
    ctx,
    text,
    {
      intent: intent.intent,
      confidence: intent.confidence,
      entities: intent.entities,
      success: ok,
      failure_reason: ok ? null : 'low_confidence_or_unknown',
      match_details: intent.match_details ?? null
    },
    ms,
    'legacy'
  )
  await logParserDetection({
    user_id: ctx.userId,
    message_id: ctx.messageId,
    raw_message: text,
    normalized_message: ctx.normalized,
    extracted_entities: intent.entities,
    selected_intent: intent.intent,
    confidence: intent.confidence,
    matched_rule: matchedRule(intent)
  })
  if (intent.confidence >= THRESHOLD && intent.intent !== 'UNKNOWN') {
    logRouting('RULE_MATCH', { messageId: ctx.messageId, intent: intent.intent, confidence: intent.confidence })
  }
  if (!useLegacyEngine()) {
    try {
      const shadow = require('../detection/shadowPipeline').runShadowDetection(text)
      await pipelineLog.logShadowDetection(ctx.messageId, shadow, Date.now() - t0, 'shadow')
    } catch (e) {
      logger.error('pipeline.shadow_detect_failed', { error: e.message })
    }
  }
  return intent
}

async function stageDetectPrimary(ctx, text) {
  const t0 = Date.now()
  const det = await detectAndPlan(text, ctx)
  const ms = Date.now() - t0
  await pipelineLog.logShadowDetection(ctx.messageId, det, ms, 'primary')
  await logParserDetection({
    user_id: ctx.userId,
    message_id: ctx.messageId,
    raw_message: text,
    normalized_message: ctx.normalized,
    extracted_entities: det.entities,
    selected_intent: `${det.domain}:${det.action}`,
    confidence: det.score,
    matched_rule: det.decision
  })
  if (!det.usedAI && det.intent?.intent) {
    logRouting('RULE_MATCH', {
      messageId: ctx.messageId,
      intent: det.intent.intent,
      winner: det.winner,
      confidence: det.score
    })
  }
  ctx.lastDetection = det
  logger.info('pipeline.detect.primary', {
    messageId: ctx.messageId,
    domain: det.domain,
    action: det.action,
    decision: det.decision,
    ms
  })
  return det.intent
}

async function stageDetect(ctx, text) {
  ctx.stage = 'detect'
  try {
    if (useLegacyEngine()) return await stageDetectLegacy(ctx, text)
    return await stageDetectPrimary(ctx, text)
  } catch (err) {
    await logDetectionRow(
      ctx,
      text,
      { intent: 'ERROR', confidence: 0, entities: {}, success: false, failure_reason: err.message },
      0,
      useLegacyEngine() ? 'legacy' : 'primary'
    )
    await pipelineLog.logSystemError('detect', err, { messageId: ctx.messageId, text })
    throw err
  }
}

async function stageAI(ctx, intent, text) {
  if (!useLegacyEngine()) return intent
  ctx.stage = 'ai_fallback'
  const ruleConf = Math.round(intent.confidence * 100)
  if (isLegacyRuleExecutable(intent, text)) {
    ctx.route_source = RouteSource.RULE
    ctx.pendingLearning = {
      message: ctx.rawMessage,
      rule_intent: intent.intent,
      rule_confidence: ruleConf,
      final_intent: intent.intent,
      entities: intent.entities,
      confidence: ruleConf,
      used_ai: false,
      normalized_message: ctx.normalized
    }
    logRouting('RULE_MATCH', { messageId: ctx.messageId, intent: intent.intent, confidence: ruleConf })
    return intent
  }
  try {
    logRouting('AI_FALLBACK', { messageId: ctx.messageId, prior_intent: intent.intent, prior_confidence: ruleConf })
    let conversationState = null
    let attachLastEntityId = (i) => i
    if (ctx.userId) {
      const ecs = require('./entityContextService')
      conversationState = await ecs.getEntityContextForAI(ctx.userId)
      attachLastEntityId = ecs.attachLastEntityId
    }
    const ai = await parseWithAI({
      rawMessage: ctx.rawMessage,
      normalized: ctx.normalized,
      deterministic: intent,
      conversationState
    })
    const merged =
      ai.success && ai.ai_intent
        ? attachLastEntityId(
            {
              ...intent,
              intent: ai.ai_intent,
              confidence: Number(ai.confidence),
              rawText: intent.rawText || text,
              entities: { ...intent.entities, ...(ai.entities || {}) },
              source: 'ai'
            },
            conversationState
          )
        : intent
    ctx.geminiResponse = ai.userResponse
    ctx.route_source = ai.success && ai.ai_intent && ai.ai_intent !== 'UNKNOWN' ? RouteSource.GEMINI : RouteSource.UNKNOWN
    ctx.pendingLearning = {
      message: ctx.rawMessage,
      rule_intent: intent.intent,
      rule_confidence: ruleConf,
      final_intent: merged.intent,
      entities: merged.entities,
      confidence: ai.success ? Math.round(Number(ai.confidence) * 100) : ruleConf,
      used_ai: true,
      normalized_message: ctx.normalized,
      model: ai.model,
      prompt_sent: ai.prompt_sent,
      ai_response: ai.ai_response,
      token_usage: ai.token_usage,
      gemini_response: ai.userResponse,
      failure_reason: ai.failure_reason
    }
    logRouting('FINAL_INTENT', { messageId: ctx.messageId, intent: merged.intent, source: 'ai' })
    return merged
  } catch (err) {
    await pipelineLog.logSystemError('ai_fallback', err, { messageId: ctx.messageId })
    return intent
  }
}

async function stageValidate(ctx, intent, text) {
  ctx.stage = 'validate'
  try {
    const { passed, error } = validateIntent(intent, text)
    await pipelineLog.logValidation(ctx.messageId, intent.intent, passed, error)
    return { passed, error }
  } catch (err) {
    await pipelineLog.logValidation(ctx.messageId, intent?.intent || 'ERROR', false, err.message)
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
    return result
  } catch (err) {
    await pipelineLog.logExecution(ctx.messageId, actionType, false, err.message, Date.now() - t0)
    throw err
  }
}

async function processClause(ctx, text, executeFn) {
  if (!useLegacyEngine()) {
    const intent = await stageDetect(ctx, text)
    const det = ctx.lastDetection
    if (
      det?.decision === Decision.CLARIFY &&
      det.decision !== Decision.REJECTED_LOW_SCORE &&
      (det.scorePercent ?? 100) >= require('../config/constants').MIN_INTENT_SCORE
    ) {
      const { handleDetectionClarify } = require('../controllers/queryController')
      return stageExecute(ctx, 'CLARIFY', () =>
        handleDetectionClarify(ctx.userId, det.intent, det.clarification)
      )
    }
    logRouting('FINAL_INTENT', { messageId: ctx.messageId, intent: intent.intent, source: ctx.lastDetection?.usedAI ? 'ai' : 'rules' })
    const validation = await stageValidate(ctx, intent, text)
    if (!validation.passed) {
      return executeFn(intent, { validationFailed: true, validationError: validation.error })
    }
    const result = await stageExecute(ctx, intent.intent, () => executeFn(intent, {}))
    if (det?.usedAI || det?.route_source === RouteSource.GEMINI) await deliverKoshyaAiResponse(ctx, intent, det, result, validation)
    return result
  }

  let intent = await stageDetect(ctx, text)
  intent = await stageAI(ctx, intent, text)
  const validation = await stageValidate(ctx, intent, text)
  if (!validation.passed) {
    return executeFn(intent, { validationFailed: true, validationError: validation.error })
  }
  const legacyResult = await stageExecute(ctx, intent.intent, () => executeFn(intent, {}))
  if (ctx.geminiResponse) {
    await deliverKoshyaAiResponse(ctx, intent, { usedAI: true, geminiResponse: ctx.geminiResponse }, legacyResult, validation)
  }
  return legacyResult
}

async function runPipeline(userId, rawMessage, routeFn) {
  const ctx = createContext(userId, rawMessage)
  const responses = []
  if (setOutboundCapture) setOutboundCapture((t) => responses.push(t))
  let result
  try {
    await stageNormalize(ctx)
    setActiveReplyMessageId(ctx.messageId)
    result = await routeFn(ctx)
    return result
  } catch (err) {
    await pipelineLog.logSystemError(ctx.stage || 'pipeline', err, {
      userId,
      rawMessage,
      messageId: ctx.messageId
    })
    throw err
  } finally {
    try {
      const allOut = [...responses, ...(ctx.capturedResponses || [])]
      const responseSent = allOut.length ? allOut[allOut.length - 1] : null
      const pl = ctx.pendingLearning || ctx.lastDetection?.pendingLearning
      if (ctx.messageId && pl) {
        const { recordDetectionLearning } = require('./aiLearningService')
        await recordDetectionLearning(ctx.messageId, {
          message: pl.message || ctx.rawMessage,
          intent: pl.final_intent || pl.intent,
          entities: pl.entities || {},
          used_ai: pl.used_ai === true,
          gemini_response: ctx.geminiRawForLog || pl.gemini_response || null,
          response_sent: ctx.koshyaResponseSent || responseSent,
          rule_intent: pl.rule_intent,
          rule_confidence: pl.rule_confidence,
          confidence: pl.confidence,
          normalized_message: pl.normalized_message
        })
      }
      await require('./parserTelemetryService').updateParserEventOutcome(ctx, result, allOut)
    } catch (_) {}
    clearOutboundCapture?.()
    clearActiveReplyMessageId()
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
