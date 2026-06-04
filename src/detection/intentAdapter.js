/** Maps Domain+Action to legacy INTENTS for existing handlers (no new business logic). */
const { INTENTS } = require('../services/intentService')
const { Domain, Action } = require('./types')
const { isChitchatMessage } = require('../config/constants')

function toLegacyIntent(det) {
  const { domain, action, entities, score, message } = det
  const lower = String(message || '').toLowerCase()
  let intent = INTENTS.UNKNOWN

  if (
    entities.serviceName &&
    /\b(?:tmrw|tomorrow|today)\b/i.test(lower) &&
    !/\b(?:remind|show|list|delete|update|renewal|renews?|ends?|expires?|expir)\b/i.test(lower)
  ) {
    return {
      intent: INTENTS.UNKNOWN,
      confidence: 0.38,
      rawText: message,
      entities: { ...entities, clarify: 'short', serviceName: entities.serviceName }
    }
  }

  if ((domain === Domain.GENERAL && action === Action.HELP) || action === Action.HELP || isChitchatMessage(message)) {
    intent = INTENTS.HELP
  }
  else if (domain === Domain.GENERAL && action === Action.LIST) intent = INTENTS.LIST_MORE
  else if (domain === Domain.REMINDER && action === Action.CREATE) intent = INTENTS.REMINDER_CREATE
  else if (domain === Domain.REMINDER && action === Action.DELETE) intent = INTENTS.REMINDER_CANCEL
  else if (domain === Domain.REMINDER && action === Action.UPDATE) intent = INTENTS.REMINDER_RESCHEDULE
  else if (domain === Domain.REMINDER && (action === Action.QUERY || action === Action.LIST)) {
    intent = INTENTS.REMINDER_QUERY
  } else if (domain === Domain.SUBSCRIPTION && action === Action.CREATE) intent = INTENTS.SUBSCRIPTION_CREATE
  else if (domain === Domain.SUBSCRIPTION && action === Action.DELETE) intent = INTENTS.SUBSCRIPTION_DELETE
  else if (domain === Domain.SUBSCRIPTION && action === Action.UPDATE) {
    intent =
      entities.queryType === 'expiry' || /\b(?:ends?|expires?|expir)/i.test(lower)
        ? INTENTS.SUBSCRIPTION_EXPIRY
        : INTENTS.SUBSCRIPTION_UPDATE
  } else if (domain === Domain.SUBSCRIPTION && (action === Action.QUERY || action === Action.LIST)) {
    intent = INTENTS.SUBSCRIPTION_QUERY
    if (entities.queryType === 'expiry' || /\bexpir/i.test(lower)) entities.queryType = 'expiry'
    if (/\bwhat\s+renews?\s+tomorrow\b/i.test(lower)) entities.queryType = 'renews_tomorrow'
  }

  return {
    intent,
    confidence: score,
    rawText: message,
    entities: { ...entities },
    domain,
    action,
    source: det.usedAI ? 'ai' : 'detection'
  }
}

module.exports = { toLegacyIntent }
