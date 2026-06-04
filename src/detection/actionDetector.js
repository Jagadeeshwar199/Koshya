/**
 * actionDetector.ts (runtime JS) — verb/query intent within a domain.
 * EXTENSION: map domain-specific phrasing before generic DELETE/LIST rules.
 */
const { Action } = require('./types')

function detectAction(lower, domain) {
  const reasons = []

  if (/^(help|start|commands|\?)$/i.test(lower.trim())) {
    return { action: Action.HELP, score: 0.95, reasons: ['help_exact'] }
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
  if (/\b(?:add|create|set|track|remind)\b/i.test(lower) || /\brenews?\b/i.test(lower)) {
    return { action: Action.CREATE, score: 0.85, reasons: ['create_verb'] }
  }
  if (domain === 'SUBSCRIPTION' && /\b(?:ends?|expires?|expir)/i.test(lower)) {
    return { action: Action.UPDATE, score: 0.8, reasons: ['expiry_signal'] }
  }

  return { action: Action.UNKNOWN, score: 0.35, reasons: ['no_action_signal'] }
}

module.exports = { detectAction }
