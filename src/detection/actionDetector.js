/**
 * actionDetector.ts (runtime JS) — verb/query intent within a domain.
 * EXTENSION: map domain-specific phrasing before generic DELETE/LIST rules.
 */
const { Action } = require('./types')

function detectAction(lower, domain, entities = {}) {
  const reasons = []

  if (/^change\s+to\b/i.test(lower.trim()) || /^make\s+it\b/i.test(lower.trim())) {
    return { action: Action.UPDATE, score: 0.92, reasons: ['reschedule_phrase'] }
  }
  if (/^(more|show more|next)$/i.test(lower.trim())) {
    return { action: Action.LIST, score: 0.95, reasons: ['list_more'] }
  }
  if (/^(help|start|commands|\?)$/i.test(lower.trim())) {
    return { action: Action.HELP, score: 0.95, reasons: ['help_exact'] }
  }
  if (/\bwhat\s+is\s+expir/i.test(lower) || (/\bexpir/i.test(lower) && /\b(?:show|what|which)\b/i.test(lower))) {
    return { action: Action.QUERY, score: 0.9, reasons: ['expiry_query'] }
  }
  if (/\b(?:show|list|what|which|how many|tell me)\b/i.test(lower)) {
    reasons.push('query_verb')
    return { action: Action.QUERY, score: 0.88, reasons }
  }
  if (/\b(?:delete|remove|cancel|stop tracking)\b/i.test(lower)) {
    return { action: Action.DELETE, score: 0.9, reasons: ['delete_verb'] }
  }
  if (/\b(?:update|change|edit|modify|reschedule|move)\b/i.test(lower)) {
    return { action: Action.UPDATE, score: 0.88, reasons: ['update_verb'] }
  }
  if (/\b(?:add|create|set|track|remind)\b/i.test(lower) || /\brenews?\b/i.test(lower) || /\bevery\s+month\b/i.test(lower)) {
    return { action: Action.CREATE, score: 0.85, reasons: ['create_verb'] }
  }
  if (
    domain === 'SUBSCRIPTION' &&
    /\brenewal\b/i.test(lower) &&
    /\b(?:today|tomorrow)\b/i.test(lower) &&
    !/\b(?:update|change|delete)\b/i.test(lower)
  ) {
    return { action: Action.QUERY, score: 0.9, reasons: ['renewal_schedule_query'] }
  }
  if (domain === 'SUBSCRIPTION' && /\b(?:ends?|expires?|expir)/i.test(lower)) {
    return { action: Action.UPDATE, score: 0.88, reasons: ['expiry_signal'] }
  }
  if (domain === 'SUBSCRIPTION' && entities.serviceName && /\b(?:tmrw|tomorrow|today)\b/i.test(lower) && !/\b(?:show|list|delete|update|renewal|renews?|ends?|expires?|expir)\b/i.test(lower)) {
    return { action: Action.UNKNOWN, score: 0.4, reasons: ['short_subscription'] }
  }

  return { action: Action.UNKNOWN, score: 0.35, reasons: ['no_action_signal'] }
}

module.exports = { detectAction }
