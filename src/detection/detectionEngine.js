/**
 * Primary detection: Message → Domain → Action → Entities → Planner → RULE | GEMINI | UNKNOWN
 */
const { normalizeText, applyTypoFixes, normalizeForIntentMatch } = require('../utils/textUtils')
const { detectDomain } = require('./domainDetector')
const { detectAction } = require('./actionDetector')
const { extract } = require('./entityExtractor')
const { planExecution } = require('./executionPlanner')
const { Decision } = require('./types')
const { parseWithAI } = require('../services/aiIntentParser')
const { toLegacyIntent } = require('./intentAdapter')
const { RouteSource, isRuleExecutable } = require('./intentRouting')
const analytics = require('../services/detectionAnalyticsService')
const { isLegacyIntentEngineEnabled, isHelpIntentMessage } = require('../config/constants')
const logger = require('../../utils/logger')
const intentDetector = require('../intent/intentDetector')
const { Domain, Action } = require('./types')

function enrichEntities(message, entities, lower) {
  const out = { ...entities }
  if (/\bexpir/i.test(lower)) out.queryType = 'expiry'
  return out
}

function runDetection(rawMessage) {
  const message = normalizeText(applyTypoFixes(rawMessage))
  const lower = normalizeForIntentMatch(message)
  const reasons = []
  let entities = enrichEntities(message, extract(message), lower)
  const d = detectDomain(lower, entities)
  reasons.push(...d.reasons)
  const a = detectAction(lower, d.domain, entities)
  reasons.push(...a.reasons)
  const combined = Math.round(((d.score + a.score) / 2) * 1000) / 1000
  const plan = planExecution(d.domain, a.action, entities, lower, {
    domainScore: d.score,
    actionScore: a.score,
    combined
  })
  reasons.push(...plan.reasons)
  const scorePercent = plan.score ?? Math.round(combined * 100)
  return {
    message,
    domain: d.domain,
    action: a.action,
    domainScore: d.score,
    actionScore: a.score,
    score: combined,
    winner: plan.winner || `${d.domain}:${a.action}`,
    scorePercent,
    entities,
    reasons,
    missingFields: plan.missingFields,
    plannerDecision: plan.decision,
    decision: plan.decision,
    clarification: plan.clarification,
    canExecute: plan.decision === Decision.EXECUTE,
    usedAI: false
  }
}

async function applyAiFallback(ctx, det) {
  const raw = ctx?.rawMessage || det.message
  const ruleIntent = detectionToIntent(det)
  const { INTENTS } = require('../services/intentService')
  const { coerceIntentForLastEntity, CLARIFY_UPDATE } = require('../services/entityUpdateCoercion')
  logger.info('AI_FALLBACK', { message: raw, rule_intent: ruleIntent.intent })
  let conversationState = null
  let attachLastEntityId = (intent) => intent
  if (ctx?.userId) {
    const ecs = require('../services/entityContextService')
    conversationState = await ecs.getEntityContextForAI(ctx.userId)
    attachLastEntityId = ecs.attachLastEntityId
    const pre = await coerceIntentForLastEntity(
      ctx.userId,
      { ...ruleIntent, rawText: raw, intent: ruleIntent.intent },
      raw
    )
    if (pre.intent === CLARIFY_UPDATE) {
      return {
        ...det,
        route_source: RouteSource.RULE,
        decision: Decision.CLARIFY,
        clarification: pre.clarificationText,
        intent: pre,
        usedAI: false,
        canExecute: false,
        pendingLearning: {
          message: raw,
          rule_intent: ruleIntent.intent,
          rule_confidence: det.scorePercent,
          final_intent: CLARIFY_UPDATE,
          used_ai: false
        }
      }
    }
  }
  const ai = await parseWithAI({
    rawMessage: raw,
    normalized: ctx?.normalized || det.message,
    deterministic: ruleIntent,
    conversationState
  })
  const confPct = ai.success ? Math.round(Number(ai.confidence) * 100) : det.scorePercent
  const baseLearning = {
    message: raw,
    rule_intent: ruleIntent.intent,
    rule_confidence: det.scorePercent,
    normalized_message: ctx?.normalized,
    model: ai.model,
    prompt_sent: ai.prompt_sent,
    ai_response: ai.ai_response,
    ai_intent: ai.raw_ai_intent || ai.ai_intent,
    token_usage: ai.token_usage,
    gemini_response: ai.userResponse
  }
  const trace = (intent, extra = {}) => ({
    ...baseLearning,
    final_intent: intent.intent,
    execution_intent: intent.execution_intent || intent.intent,
    last_entity_id: intent.lastEntityId || conversationState?.last_entity_id || null,
    entities: intent.entities,
    confidence: extra.confidence ?? confPct,
    used_ai: extra.used_ai !== false,
    ai_intent: extra.ai_intent ?? baseLearning.ai_intent,
    failure_reason: extra.failure_reason ?? null
  })

  if (!ai.success || !ai.ai_intent || ai.ai_intent === INTENTS.UNKNOWN) {
    if (ctx?.userId) {
      const coerced = await coerceIntentForLastEntity(
        ctx.userId,
        { ...ruleIntent, rawText: raw, intent: ruleIntent.intent },
        raw
      )
      if (coerced.intent === CLARIFY_UPDATE) {
        return {
          ...det,
          route_source: RouteSource.RULE,
          decision: Decision.CLARIFY,
          clarification: coerced.clarificationText,
          intent: coerced,
          usedAI: Boolean(ai.success),
          aiMeta: ai,
          canExecute: false,
          pendingLearning: trace(coerced, { used_ai: Boolean(ai.success), confidence: 70 })
        }
      }
      if (
        coerced.lastEntityId &&
        (coerced.intent === INTENTS.REMINDER_RESCHEDULE || coerced.intent === INTENTS.SUBSCRIPTION_UPDATE)
      ) {
        logger.info('UPDATE_FLOW', {
          message: raw,
          rule_intent: ruleIntent.intent,
          ai_intent: coerced.ai_intent || 'UPDATE_REMINDER',
          final_intent: coerced.intent,
          execution_intent: coerced.execution_intent || coerced.intent,
          last_entity_id: coerced.lastEntityId
        })
        return {
          ...det,
          route_source: RouteSource.RULE,
          intent: coerced,
          usedAI: Boolean(ai.success),
          aiMeta: ai,
          decision: Decision.EXECUTE,
          canExecute: true,
          pendingLearning: trace(coerced, {
            ai_intent: coerced.ai_intent || 'UPDATE_REMINDER',
            used_ai: Boolean(ai.success),
            confidence: 90
          })
        }
      }
    }
    return {
      ...det,
      route_source: RouteSource.UNKNOWN,
      intent: { intent: INTENTS.UNKNOWN, confidence: 0, rawText: raw, entities: ruleIntent.entities || {} },
      usedAI: true,
      aiMeta: ai,
      decision: Decision.AI_FALLBACK,
      canExecute: false,
      pendingLearning: trace(
        { intent: INTENTS.UNKNOWN, entities: ruleIntent.entities },
        { used_ai: true, confidence: det.scorePercent, failure_reason: ai.failure_reason }
      )
    }
  }
  let intent = attachLastEntityId(
    {
      intent: ai.ai_intent,
      confidence: Number(ai.confidence),
      rawText: raw,
      entities: { ...ruleIntent.entities, ...(ai.entities || {}) },
      source: 'ai',
      ai_intent: ai.raw_ai_intent || 'UPDATE_REMINDER',
      execution_intent: ai.ai_intent
    },
    conversationState
  )
  if (ctx?.userId) {
    intent = await coerceIntentForLastEntity(ctx.userId, intent, raw)
  }
  if (intent.intent === CLARIFY_UPDATE) {
    return {
      ...det,
      route_source: RouteSource.RULE,
      decision: Decision.CLARIFY,
      clarification: intent.clarificationText,
      intent,
      usedAI: true,
      aiMeta: ai,
      canExecute: false,
      pendingLearning: trace(intent, { used_ai: true, confidence: confPct })
    }
  }
  logger.info('UPDATE_FLOW', {
    message: raw,
    rule_intent: ruleIntent.intent,
    ai_intent: baseLearning.ai_intent,
    final_intent: intent.intent,
    execution_intent: intent.execution_intent || intent.intent,
    last_entity_id: intent.lastEntityId || conversationState?.last_entity_id || null
  })
  return {
    ...det,
    route_source: RouteSource.GEMINI,
    intent,
    usedAI: true,
    aiMeta: ai,
    geminiResponse: ai.userResponse,
    scorePercent: confPct,
    decision: Decision.EXECUTE,
    canExecute: true,
    pendingLearning: trace(intent, { used_ai: true })
  }
}

function detectionToIntent(det) {
  return toLegacyIntent(det)
}

function dialogueIntent(message) {
  const t = String(message || '').trim().toLowerCase()
  if (/^(yes|confirm|ok|okay|k)$/.test(t)) return 'CONFIRM'
  if (/^(no|cancel|stop)$/.test(t)) return 'CANCEL'
  if (/^(more|show more|next)$/.test(t)) return 'LIST_MORE'
  return null
}

function applyHelpFastPath(det) {
  if (!isHelpIntentMessage(det.message)) return det
  det.domain = Domain.GENERAL
  det.action = Action.HELP
  det.decision = Decision.EXECUTE
  det.winner = 'GENERAL:HELP'
  det.canExecute = true
  return det
}

async function detectAndPlan(rawMessage, ctx = null) {
  const { INTENTS } = require('../services/intentService')
  const dialogue = dialogueIntent(rawMessage)
  if (dialogue) {
    const intent = dialogue === 'CONFIRM' ? INTENTS.CONFIRM : dialogue === 'CANCEL' ? INTENTS.CANCEL : INTENTS.LIST_MORE
    const det = {
      message: rawMessage,
      domain: 'GENERAL',
      action: dialogue === 'LIST_MORE' ? 'LIST' : 'UNKNOWN',
      score: 0.99,
      entities: {},
      decision: Decision.EXECUTE,
      usedAI: false,
      route_source: RouteSource.RULE
    }
    det.intent = { intent, confidence: 0.99, rawText: rawMessage, entities: {} }
    analytics.recordExecution()
    return det
  }

  const msg = ctx?.rawMessage || rawMessage
  let det = applyHelpFastPath(runDetection(rawMessage))
  const ruleIntent = detectionToIntent(det)

  if (isRuleExecutable(det, ruleIntent)) {
    det.route_source = RouteSource.RULE
    det.intent = ruleIntent
    det.usedAI = false
    det.pendingLearning = {
      message: msg,
      rule_intent: ruleIntent.intent,
      rule_confidence: det.scorePercent,
      final_intent: ruleIntent.intent,
      entities: ruleIntent.entities,
      confidence: det.scorePercent,
      used_ai: false,
      normalized_message: ctx?.normalized
    }
    analytics.recordExecution()
  } else {
    analytics.recordAiFallback(det.message)
    det = await applyAiFallback(ctx, det)
    if (det.route_source === RouteSource.GEMINI) analytics.recordExecution()
  }

  if (!det.intent) det.intent = detectionToIntent(det)
  logger.info('FINAL_INTENT', {
    message: msg,
    intent: det.intent.intent,
    route_source: det.route_source,
    used_ai: det.usedAI === true
  })
  return det
}

function splitClauses(message) {
  const parts = intentDetector.clauseParts(normalizeText(applyTypoFixes(message)))
  return parts.length > 1 ? parts : [message]
}

function useLegacyEngine() {
  return isLegacyIntentEngineEnabled()
}

module.exports = {
  runDetection,
  detectAndPlan,
  detectionToIntent,
  applyAiFallback,
  splitClauses,
  useLegacyEngine,
  Decision,
  RouteSource
}
