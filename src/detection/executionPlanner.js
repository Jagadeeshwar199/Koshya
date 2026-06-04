/**
 * executionPlanner — EXECUTE | CLARIFY | AI_FALLBACK. EXTENSION: domain-specific rules.
 */
const { Domain, Action, Decision } = require('./types')
const {
  MIN_DOMAIN_SCORE,
  MIN_ACTION_SCORE,
  AI_FALLBACK_THRESHOLD
} = require('../config/constants')
const { buildClarification } = require('./clarification')

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
  const domainScore = scores.domainScore
  const actionScore = scores.actionScore
  const combined = scores.combined

  if (domain !== Domain.UNKNOWN && action === Action.UNKNOWN) {
    return {
      decision: Decision.CLARIFY,
      missingFields: ['action'],
      clarification: buildClarification(domain, action, entities, ['action']),
      reasons: [...reasons, 'unknown_action']
    }
  }
  if (
    domain === Domain.UNKNOWN ||
    domainScore < MIN_DOMAIN_SCORE ||
    actionScore < MIN_ACTION_SCORE ||
    combined < AI_FALLBACK_THRESHOLD
  ) {
    return {
      decision: Decision.AI_FALLBACK,
      missingFields: missingFor(domain, action, entities, lower),
      clarification: null,
      reasons: [...reasons, 'low_scores_or_unknown']
    }
  }

  const missingFields = missingFor(domain, action, entities, lower)
  if (missingFields.length) {
    return {
      decision: Decision.CLARIFY,
      missingFields,
      clarification: buildClarification(domain, action, entities, missingFields),
      reasons: [...reasons, 'missing_entities']
    }
  }

  return { decision: Decision.EXECUTE, missingFields: [], clarification: null, reasons }
}

/** @deprecated use planExecution */
function plan(domain, action, entities) {
  const p = planExecution(domain, action, entities, '', { domainScore: 1, actionScore: 1, combined: 1 })
  return {
    canExecute: p.decision === Decision.EXECUTE,
    missingFields: p.missingFields,
    reasons: p.reasons
  }
}

module.exports = { planExecution, plan, Decision }
