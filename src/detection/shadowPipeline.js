/**
 * Shadow detection pipeline — runs parallel to legacy intent engine; never routes WhatsApp.
 * EXTENSION: wire new detectors here, then flip feature flag when ready for production.
 */
const { normalizeText, applyTypoFixes, normalizeForIntentMatch } = require('../utils/textUtils')
const { detectDomain } = require('./domainDetector')
const { detectAction } = require('./actionDetector')
const { extract } = require('./entityExtractor')
const { plan } = require('./executionPlanner')

function runShadowDetection(rawMessage) {
  const message = normalizeText(applyTypoFixes(rawMessage))
  const lower = normalizeForIntentMatch(message)
  const reasons = []

  const d = detectDomain(lower)
  reasons.push(...d.reasons)
  const a = detectAction(lower, d.domain)
  reasons.push(...a.reasons)
  const entities = extract(message)
  const p = plan(d.domain, a.action, entities)
  reasons.push(...p.reasons)

  const score = Math.round(Math.min(0.99, (d.score + a.score) / 2) * 1000) / 1000

  return {
    domain: d.domain,
    action: a.action,
    score,
    entities,
    reasons,
    canExecute: p.canExecute,
    missingFields: p.missingFields,
    usedAI: false,
    message
  }
}

module.exports = { runShadowDetection }
