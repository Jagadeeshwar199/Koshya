/** Rule routing helpers — executable vs Gemini fallback (no confidence threshold). */
const { INTENTS } = require('../services/intentService')
const { Decision } = require('../detection/types')
const { isHelpIntentMessage } = require('../config/constants')

const RouteSource = { RULE: 'RULE', GEMINI: 'GEMINI', UNKNOWN: 'UNKNOWN' }

function isAmbiguousRuleMessage(message) {
  const t = String(message || '').trim()
  return (
    /^(sorry|actually|oops|wait|hm|hmm)\b/i.test(t) ||
    /^move it to\b/i.test(t) ||
    /^actually\s+/i.test(t)
  )
}

function isRuleExecutable(det, ruleIntent) {
  if (isHelpIntentMessage(det.message)) return true
  if (isAmbiguousRuleMessage(det.message)) return false
  if (!ruleIntent?.intent || ruleIntent.intent === INTENTS.UNKNOWN) return false
  if (det.decision !== Decision.EXECUTE) return false
  return true
}

function isLegacyRuleExecutable(intent, text) {
  if (isHelpIntentMessage(text)) return true
  if (isAmbiguousRuleMessage(text)) return false
  return !!(intent?.intent && intent.intent !== INTENTS.UNKNOWN)
}

module.exports = { RouteSource, isRuleExecutable, isLegacyRuleExecutable, isAmbiguousRuleMessage }
