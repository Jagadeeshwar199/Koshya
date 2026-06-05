/**
 * Primary detection: Message → Domain → Action → Entities → Planner.
 * EXTENSION: register detectors in runDetection(); never execute from AI.
 */
const { normalizeText, applyTypoFixes, normalizeForIntentMatch } = require('../utils/textUtils')
const { detectDomain } = require('./domainDetector')
const { detectAction } = require('./actionDetector')
const { extract } = require('./entityExtractor')
const { planExecution } = require('./executionPlanner')
const { Decision } = require('./types')
const { parseWithAI } = require('../services/aiIntentParser')
const { toLegacyIntent } = require('./intentAdapter')
const analytics = require('../services/detectionAnalyticsService')
const {
  isLegacyIntentEngineEnabled,
  MIN_INTENT_SCORE,
  AI_THRESHOLD,
  isHelpIntentMessage
} = require('../config/constants')
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

  const winner = plan.winner || `${d.domain}:${a.action}`
  const scorePercent = plan.score ?? Math.round(combined * 100)

  return {
    message,
    domain: d.domain,
    action: a.action,
    domainScore: d.score,
    actionScore: a.score,
    score: combined,
    winner,
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

function lowScoreRejectionPayload(det) {
  return {
    message: det.message,
    winner: det.winner,
    score: det.scorePercent,
    decision: Decision.REJECTED_LOW_SCORE
  }
}

function logRejectedLowScore(det) {
  const payload = lowScoreRejectionPayload(det)
  logger.info('detection.rejected_low_score', payload)
  det.rejectionLog = payload
  return det
}

function finalizeWeakDetection(det) {
  logger.info('detection.winner', {
    winner: det.winner,
    score: det.scorePercent,
    decision: det.decision,
    planner_decision: det.plannerDecision,
    used_ai: det.usedAI === true,
    can_execute: det.canExecute === true,
    message: det.message
  })
  if (isHelpIntentMessage(det.message)) {
    det.domain = Domain.GENERAL
    det.action = Action.HELP
    det.decision = Decision.EXECUTE
    det.clarification = null
    det.winner = 'GENERAL:HELP'
    det.scorePercent = 99
    det.canExecute = true
    det.reasons.push('help_intent_routed')
    return det
  }
  if (det.scorePercent >= MIN_INTENT_SCORE) return det
  det.decision = Decision.REJECTED_LOW_SCORE
  det.clarification = null
  det.canExecute = false
  det.reasons.push(`weak_score_guard:${det.scorePercent}`)
  return logRejectedLowScore(det)
}

async function applyAiFallback(ctx, det) {
  const raw = ctx?.rawMessage || det.message
  const ruleIntent = detectionToIntent(det)
  logger.info('AI_FALLBACK', { message: raw, rule_intent: ruleIntent.intent, rule_confidence: det.scorePercent })
  const ai = await parseWithAI({
    rawMessage: raw,
    normalized: ctx?.normalized || det.message,
    deterministic: ruleIntent
  })
  if (!ai.success) {
    return finalizeWeakDetection({ ...det, decision: Decision.AI_FALLBACK, clarification: null, usedAI: true, aiMeta: ai })
  }
  const intent = {
    intent: ai.ai_intent,
    confidence: Number(ai.confidence),
    rawText: raw,
    entities: { ...ruleIntent.entities, ...(ai.entities || {}) },
    source: 'ai'
  }
  const confPct = Math.round(ai.confidence * 100)
  return {
    ...det,
    intent,
    usedAI: true,
    aiMeta: ai,
    geminiResponse: ai.userResponse,
    scorePercent: confPct,
    decision: Decision.EXECUTE,
    canExecute: true,
    pendingLearning: {
      message: raw,
      rule_intent: ruleIntent.intent,
      rule_confidence: det.scorePercent,
      final_intent: intent.intent,
      entities: intent.entities,
      confidence: confPct,
      used_ai: true,
      normalized_message: ctx?.normalized,
      model: ai.model,
      prompt_sent: ai.prompt_sent,
      ai_response: ai.ai_response,
      token_usage: ai.token_usage,
      gemini_response: ai.userResponse
    }
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

async function detectAndPlan(rawMessage, ctx = null) {
  const dialogue = dialogueIntent(rawMessage)
  if (dialogue) {
    const { INTENTS } = require('../services/intentService')
    const intent = dialogue === 'CONFIRM' ? INTENTS.CONFIRM : dialogue === 'CANCEL' ? INTENTS.CANCEL : INTENTS.LIST_MORE
    const det = {
      message: rawMessage,
      domain: 'GENERAL',
      action: dialogue === 'LIST_MORE' ? 'LIST' : 'UNKNOWN',
      score: 0.99,
      entities: {},
      decision: Decision.EXECUTE,
      usedAI: false
    }
    det.intent = { intent, confidence: 0.99, rawText: rawMessage, entities: {} }
    analytics.recordExecution()
    return det
  }

  let det = finalizeWeakDetection(runDetection(rawMessage))
  const ruleIntent = detectionToIntent(det)
  const ruleConf = det.scorePercent
  const msg = ctx?.rawMessage || rawMessage
  const useRules = isHelpIntentMessage(det.message) || ruleConf >= AI_THRESHOLD

  if (useRules) {
    det.intent = ruleIntent
    det.pendingLearning = {
      message: msg,
      rule_intent: ruleIntent.intent,
      rule_confidence: ruleConf,
      final_intent: ruleIntent.intent,
      entities: ruleIntent.entities,
      confidence: ruleConf,
      used_ai: false,
      normalized_message: ctx?.normalized
    }
  } else {
    analytics.recordAiFallback(det.message)
    det = finalizeWeakDetection(await applyAiFallback(ctx, det))
    if (det.decision === Decision.REJECTED_LOW_SCORE) det = logRejectedLowScore(det)
    if (!det.intent) det.intent = detectionToIntent(det)
  }

  if (!det.intent) det.intent = detectionToIntent(det)
  if (det.decision === Decision.CLARIFY && det.scorePercent >= MIN_INTENT_SCORE) {
    analytics.recordClarification(det.message)
  }
  if (det.decision === Decision.EXECUTE) analytics.recordExecution()
  if (det.intent.entities?.clarify === 'short') det.decision = Decision.EXECUTE
  logger.info('FINAL_INTENT', { message: msg, intent: det.intent.intent, used_ai: det.usedAI === true, confidence: ruleConf })
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
  Decision
}
