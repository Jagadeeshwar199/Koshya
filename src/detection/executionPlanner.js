/**
 * executionPlanner — EXECUTE when rule-complete, else AI_FALLBACK (Gemini). No score threshold.
 */
const { Domain, Action, Decision } = require('./types')
const { isHelpIntentMessage } = require('../config/constants')

function missingFor(domain, action, entities, lower = '') {
  const missingFields = []
  if (domain === Domain.UNKNOWN || action === Action.UNKNOWN) {
    missingFields.push('domain_or_action')
    return missingFields
  }
  if (action === Action.HELP || action === Action.QUERY || action === Action.LIST) {
    return missingFields
  }
  if (domain === Domain.REMINDER && action === Action.CREATE) {
    if (!entities.actionText && !entities.serviceName && !/\bremind\s+me\b/i.test(lower)) {
      missingFields.push('subject')
    }
    if (!entities.date) missingFields.push('date')
  }
  if (domain === Domain.SUBSCRIPTION && action === Action.CREATE) {
    if (!entities.serviceName) missingFields.push('serviceName')
    if (!entities.amount && !entities.recurrence) missingFields.push('amount_or_recurrence')
  }
  if (action === Action.UPDATE || action === Action.DELETE) {
    if (!entities.serviceName && !entities.actionText) missingFields.push('target')
  }
  return missingFields
}

function planExecution(domain, action, entities, lower, scores) {
  const reasons = [`plan:${domain}+${action}`]
  const combined = scores.combined
  const scorePct = Math.round(combined * 100)
  const winner = `${domain}:${action}`
  const base = { missingFields: [], clarification: null, winner, score: scorePct }

  if (isHelpIntentMessage(lower)) {
    return { decision: Decision.EXECUTE, reasons: [...reasons, 'help_intent'], winner: 'GENERAL:HELP', score: 95, ...base }
  }
  if ((action === Action.CREATE || action === Action.UPDATE) && scorePct < 90) {
    return { decision: Decision.AI_FALLBACK, reasons: [...reasons, 'score_below_90'], ...base }
  }
  if (domain === Domain.UNKNOWN || action === Action.UNKNOWN) {
    return { decision: Decision.AI_FALLBACK, reasons: [...reasons, 'unknown_domain_or_action'], ...base }
  }
  const missingFields = missingFor(domain, action, entities, lower)
  if (missingFields.length) {
    return { decision: Decision.AI_FALLBACK, missingFields, reasons: [...reasons, 'missing_entities'], ...base }
  }
  return { decision: Decision.EXECUTE, reasons, ...base }
}

function plan(domain, action, entities) {
  const p = planExecution(domain, action, entities, '', { domainScore: 1, actionScore: 1, combined: 1 })
  return { canExecute: p.decision === Decision.EXECUTE, missingFields: p.missingFields, reasons: p.reasons }
}

module.exports = { planExecution, plan, Decision, missingFor }
