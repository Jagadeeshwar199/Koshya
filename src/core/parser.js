/**
 * Single parser — rule-based first; AI only when required fields are missing.
 */
const { parseFirst } = require('../services/parseFirstService')
const { detectIntent, INTENTS } = require('../services/intentService')
const { runDetection } = require('../detection/detectionEngine')
const { parseWithAI } = require('../services/aiIntentParser')
const { missingFor } = require('../detection/executionPlanner')
const { Domain, Action } = require('../detection/types')

function intentToDomainAction(intentName) {
  if (intentName?.startsWith('REMINDER_')) return { domain: Domain.REMINDER, action: mapReminderAction(intentName) }
  if (intentName?.startsWith('SUBSCRIPTION_')) return { domain: Domain.SUBSCRIPTION, action: mapSubscriptionAction(intentName) }
  if (intentName === INTENTS.HELP || intentName === INTENTS.LIST_MORE) return { domain: Domain.GENERAL, action: Action.HELP }
  if (intentName === INTENTS.DELETE_ENTITY) return { domain: Domain.GENERAL, action: Action.DELETE }
  return { domain: Domain.UNKNOWN, action: Action.UNKNOWN }
}

function mapReminderAction(intent) {
  if (intent === INTENTS.REMINDER_CREATE) return Action.CREATE
  if (intent === INTENTS.REMINDER_CANCEL) return Action.DELETE
  if (intent === INTENTS.REMINDER_UPDATE || intent === INTENTS.REMINDER_RESCHEDULE) return Action.UPDATE
  if (intent === INTENTS.REMINDER_QUERY) return Action.QUERY
  return Action.UNKNOWN
}

function mapSubscriptionAction(intent) {
  if (intent === INTENTS.SUBSCRIPTION_CREATE) return Action.CREATE
  if (intent === INTENTS.SUBSCRIPTION_DELETE) return Action.DELETE
  if (intent === INTENTS.SUBSCRIPTION_UPDATE || intent === INTENTS.SUBSCRIPTION_EXPIRY) return Action.UPDATE
  if (intent === INTENTS.SUBSCRIPTION_QUERY) return Action.QUERY
  return Action.UNKNOWN
}

function extractTriggerTime(entities) {
  if (!entities?.date) return null
  return entities.date
}

async function parseWithRules(rawMessage) {
  const pf = parseFirst(rawMessage)
  const rule = detectIntent(pf.normalized)
  const det = runDetection(rawMessage)
  const { domain, action } = det.domain !== Domain.UNKNOWN
    ? { domain: det.domain, action: det.action }
    : intentToDomainAction(rule.intent)

  return {
    rawMessage,
    normalized: pf.normalized,
    event_name: pf.taskText,
    scheduleText: pf.scheduleText,
    entities: { ...pf.entities, ...det.entities },
    domain,
    action,
    intent: rule.intent,
    confidence: Math.max(rule.confidence || 0, det.score || 0),
    ruleScore: pf.ruleScore,
    parser_used: true,
    ai_used: false,
    failure_reason: null,
    meta: { pf, det, rule }
  }
}

async function parseWithAiFallback(parsed, ctx) {
  const ai = await parseWithAI({
    rawMessage: parsed.rawMessage,
    normalized: parsed.normalized,
    conversationState: ctx?.conversationState || null
  })
  if (!ai?.success) {
    return { ...parsed, failure_reason: 'ai_fallback_failed' }
  }

  const pf = parseFirst(parsed.rawMessage, ai)
  const intent = ai.ai_intent || parsed.intent
  const { domain, action } = intentToDomainAction(intent)

  return {
    ...parsed,
    event_name: pf.taskText,
    scheduleText: pf.scheduleText,
    entities: { ...parsed.entities, ...(ai.entities || {}) },
    domain: domain !== Domain.UNKNOWN ? domain : parsed.domain,
    action: action !== Action.UNKNOWN ? action : parsed.action,
    intent,
    confidence: Number(ai.confidence || parsed.confidence),
    ai_used: true,
    failure_reason: null,
    meta: { ...parsed.meta, ai }
  }
}

async function parseMessage(rawMessage, options = {}) {
  const { ctx, skipAi = false } = options
  let parsed = await parseWithRules(rawMessage)

  if (skipAi) return parsed

  const missing = missingFor(parsed.domain, parsed.action, parsed.entities, parsed.normalized)
  const ruleConfident = (parsed.ruleScore || 0) >= 90 && parsed.intent !== INTENTS.UNKNOWN
  if (!ruleConfident && missing.length) {
    parsed = await parseWithAiFallback(parsed, ctx)
  }

  return parsed
}

module.exports = {
  parseMessage,
  parseWithRules,
  extractTriggerTime,
  intentToDomainAction
}
