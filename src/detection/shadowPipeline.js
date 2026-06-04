/**
 * Shadow detection pipeline — runs parallel to legacy intent engine; never routes WhatsApp.
 * EXTENSION: wire new detectors here, then flip feature flag when ready for production.
 */
const { normalizeText, applyTypoFixes, normalizeForIntentMatch } = require('../utils/textUtils')
const { detectDomain } = require('./domainDetector')
const { detectAction } = require('./actionDetector')
const { extract } = require('./entityExtractor')
const { planExecution } = require('./executionPlanner')
const { Decision } = require('./types')

function runShadowDetection(rawMessage) {
  const message = normalizeText(applyTypoFixes(rawMessage))
  const lower = normalizeForIntentMatch(message)
  const reasons = []

  const entities = extract(message)
  const d = detectDomain(lower, entities)
  reasons.push(...d.reasons)
  const a = detectAction(lower, d.domain, entities)
  reasons.push(...a.reasons)
  const combined = Math.round(Math.min(0.99, (d.score + a.score) / 2) * 1000) / 1000
  const p = planExecution(d.domain, a.action, entities, lower, {
    domainScore: d.score,
    actionScore: a.score,
    combined
  })
  reasons.push(...p.reasons)

  return {
    domain: d.domain,
    action: a.action,
    score: combined,
    entities,
    reasons,
    decision: p.decision,
    canExecute: p.decision === Decision.EXECUTE,
    missingFields: p.missingFields,
    usedAI: false,
    message
  }
}

module.exports = { runShadowDetection }
