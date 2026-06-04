/**
 * domainDetector.ts (runtime JS) — classifies which product domain owns the message.
 * EXTENSION: add Domain enum value + branch here (e.g. BILLING, TASKS).
 */
const { Domain } = require('./types')
const { isChitchatMessage } = require('../config/constants')
const { groupScore } = require('../intent/fuzzyMatcher')
const {
  REMINDER_TERMS,
  SUBSCRIPTION_TERMS,
  DEFAULT_FUZZY_THRESHOLD
} = require('../intent/semanticDictionaries')

function detectDomain(lower, entities = {}) {
  if (isChitchatMessage(lower)) {
    return { domain: Domain.GENERAL, score: 0.95, reasons: ['chitchat'] }
  }
  const reminder = groupScore(lower, REMINDER_TERMS, DEFAULT_FUZZY_THRESHOLD)
  const subscription = groupScore(lower, SUBSCRIPTION_TERMS, DEFAULT_FUZZY_THRESHOLD)
  const reasons = []

  if (/\bchange\s+to\b/i.test(lower) || /^make\s+it\b/i.test(lower)) {
    return { domain: Domain.REMINDER, score: 0.85, reasons: ['reschedule_context'] }
  }
  if (/\bwhat\s+renews?\s+tomorrow\b/i.test(lower) || /\bwhat\s+is\s+due\s+tomorrow\b/i.test(lower)) {
    return { domain: Domain.SUBSCRIPTION, score: 0.9, reasons: ['renewal_query'] }
  }
  if (/\bwhat\s+is\s+expir/i.test(lower) || /\bexpir(?:ing|es?)\s+soon\b/i.test(lower)) {
    return { domain: Domain.SUBSCRIPTION, score: 0.88, reasons: ['expiry_query'] }
  }
  if (
    entities.serviceName &&
    /\b(?:ends?|expires?|expir|renews?|every\s+month|monthly|yearly)\b/i.test(lower)
  ) {
    reasons.push('service_schedule')
    return { domain: Domain.SUBSCRIPTION, score: 0.82, reasons }
  }
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
  if (/\b(?:pay|rent|emi)\b/i.test(lower) && !/\b(?:subscription|monthly|yearly)\b/i.test(lower)) {
    reasons.push('payment_reminder')
    return { domain: Domain.REMINDER, score: 0.6, reasons }
  }
  if (/\b(?:subscription|renew|netflix|spotify)\b/i.test(lower)) {
    reasons.push('subscription_keyword')
    return { domain: Domain.SUBSCRIPTION, score: 0.55, reasons }
  }

  return { domain: Domain.UNKNOWN, score: 0.35, reasons: ['no_domain_signal'] }
}

module.exports = { detectDomain }
