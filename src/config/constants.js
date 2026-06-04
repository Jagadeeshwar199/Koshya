/** Detection engine thresholds (override via env). */
const MIN_DOMAIN_SCORE = Number(process.env.MIN_DOMAIN_SCORE || 0.45)
const MIN_ACTION_SCORE = Number(process.env.MIN_ACTION_SCORE || 0.45)
const AI_FALLBACK_THRESHOLD = Number(process.env.AI_FALLBACK_THRESHOLD || 0.45)
const MIN_INTENT_SCORE = Number(process.env.MIN_INTENT_SCORE || 25)

function isHelpIntentMessage(text) {
  const t = String(text || '').trim()
  if (/^(?:hi|hello|hey|thanks|thank\s+you|how\s+are\s+you|help|start|commands|\?)$/i.test(t)) return true
  if (/^good\s+(?:morning|evening|night)[!.?\s]*$/i.test(t)) return true
  if (/^what\s+can\s+you\s+do\??$/i.test(t)) return true
  return /^(?:ok|okay)[!.?\s]*$/i.test(t)
}

function isChitchatMessage(text) {
  return isHelpIntentMessage(text)
}

function isLegacyIntentEngineEnabled() {
  return process.env.ENABLE_LEGACY_INTENT_ENGINE === 'true'
}

module.exports = {
  MIN_DOMAIN_SCORE,
  MIN_ACTION_SCORE,
  AI_FALLBACK_THRESHOLD,
  MIN_INTENT_SCORE,
  isHelpIntentMessage,
  isChitchatMessage,
  isLegacyIntentEngineEnabled
}
