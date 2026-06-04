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
const { inferWithAI } = require('./aiDomainParser')
const { toLegacyIntent } = require('./intentAdapter')
const analytics = require('../services/detectionAnalyticsService')
const { isLegacyIntentEngineEnabled } = require('../config/constants')
const intentDetector = require('../intent/intentDetector')

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

  return {
    message,
    domain: d.domain,
    action: a.action,
    domainScore: d.score,
    actionScore: a.score,
    score: combined,
    entities,
    reasons,
    missingFields: plan.missingFields,
    decision: plan.decision,
    clarification: plan.clarification,
    canExecute: plan.decision === Decision.EXECUTE,
    usedAI: false
  }
}

async function applyAiFallback(ctx, det) {
  const ai = await inferWithAI({
    rawMessage: ctx?.rawMessage || det.message,
    normalized: ctx?.normalized || det.message,
    partial: { domain: det.domain, action: det.action, entities: det.entities }
  })
  if (!ai.success) return { ...det, decision: Decision.CLARIFY, clarification: 'I could not understand that. Can you rephrase?' }

  const lower = normalizeForIntentMatch(det.message)
  let entities = enrichEntities(det.message, { ...det.entities, ...ai.entities }, lower)
  const combined = Math.round(((ai.confidence + ai.confidence) / 2) * 1000) / 1000
  const plan = planExecution(ai.domain, ai.action, entities, lower, {
    domainScore: ai.confidence,
    actionScore: ai.confidence,
    combined
  })
  const next = {
    ...det,
    domain: ai.domain,
    action: ai.action,
    domainScore: ai.confidence,
    actionScore: ai.confidence,
    score: combined,
    entities,
    decision: plan.decision,
    clarification: plan.clarification,
    missingFields: plan.missingFields,
    usedAI: true,
    aiMeta: ai
  }
  return next
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

  let det = runDetection(rawMessage)
  if (det.decision === Decision.AI_FALLBACK) {
    analytics.recordAiFallback(det.message)
    det = await applyAiFallback(ctx, det)
    if (det.decision === Decision.AI_FALLBACK) {
      analytics.recordClarification(det.message)
      det.decision = Decision.CLARIFY
      det.clarification = det.clarification || 'What would you like me to do?'
    }
  }
  if (det.decision === Decision.CLARIFY) analytics.recordClarification(det.message)
  if (det.decision === Decision.EXECUTE) analytics.recordExecution()

  det.intent = detectionToIntent(det)
  if (det.intent.entities?.clarify === 'short') det.decision = Decision.EXECUTE
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
