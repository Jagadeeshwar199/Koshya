/** Detection engine thresholds (override via env). */
const MIN_DOMAIN_SCORE = Number(process.env.MIN_DOMAIN_SCORE || 0.45)
const MIN_ACTION_SCORE = Number(process.env.MIN_ACTION_SCORE || 0.45)
const AI_FALLBACK_THRESHOLD = Number(process.env.AI_FALLBACK_THRESHOLD || 0.45)

function isLegacyIntentEngineEnabled() {
  return process.env.ENABLE_LEGACY_INTENT_ENGINE === 'true'
}

module.exports = {
  MIN_DOMAIN_SCORE,
  MIN_ACTION_SCORE,
  AI_FALLBACK_THRESHOLD,
  isLegacyIntentEngineEnabled
}
