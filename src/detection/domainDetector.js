/**
 * domainDetector.ts (runtime JS) — classifies which product domain owns the message.
 * EXTENSION: add Domain enum value + branch here (e.g. BILLING, TASKS).
 */
const { Domain } = require('./types')
const { groupScore } = require('../intent/fuzzyMatcher')
const {
  REMINDER_TERMS,
  SUBSCRIPTION_TERMS,
  DEFAULT_FUZZY_THRESHOLD
} = require('../intent/semanticDictionaries')

function detectDomain(lower) {
  const reminder = groupScore(lower, REMINDER_TERMS, DEFAULT_FUZZY_THRESHOLD)
  const subscription = groupScore(lower, SUBSCRIPTION_TERMS, DEFAULT_FUZZY_THRESHOLD)
  const reasons = []

  if (/^(help|start|hi|hello|what can you do)/i.test(lower.trim())) {
    return { domain: Domain.GENERAL, score: 0.9, reasons: ['help_phrase'] }
  }

  if (reminder > subscription && reminder > 0.25) {
    reasons.push(`reminder_semantic:${reminder.toFixed(2)}`)
    return { domain: Domain.REMINDER, score: Math.min(0.99, 0.5 + reminder), reasons }
  }
  if (subscription > 0.25) {
    reasons.push(`subscription_semantic:${subscription.toFixed(2)}`)
    return { domain: Domain.SUBSCRIPTION, score: Math.min(0.99, 0.5 + subscription), reasons }
  }
  if (reminder > 0.15 || /\bremind\b/i.test(lower)) {
    reasons.push('reminder_keyword')
    return { domain: Domain.REMINDER, score: 0.55, reasons }
  }
  if (/\b(?:subscription|renew|netflix|spotify)\b/i.test(lower)) {
    reasons.push('subscription_keyword')
    return { domain: Domain.SUBSCRIPTION, score: 0.55, reasons }
  }

  return { domain: Domain.UNKNOWN, score: 0.35, reasons: ['no_domain_signal'] }
}

module.exports = { detectDomain }
