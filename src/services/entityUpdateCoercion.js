const { INTENTS, detectIntent } = require('./intentService')
const { getLastEntity } = require('./entityContextService')
const { isCorrectionEntityName } = require('../intent/entityExtractor')

function extractDayFromText(text) {
  const m = String(text || '').match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i)
  const n = m ? Number(m[1]) : null
  return n >= 1 && n <= 31 ? n : null
}

function isFollowUpUpdatePhrase(text) {
  return /^(sorry|actually|instead|change|move|make it|oops)\b/i.test(String(text || '').trim())
}

function scrubCorrectionEntities(entities) {
  const out = { ...(entities || {}) }
  if (isCorrectionEntityName(out.serviceName)) delete out.serviceName
  if (isCorrectionEntityName(out.actionText)) delete out.actionText
  return out
}

async function coerceIntentForLastEntity(sender, intent, text) {
  const last = await getLastEntity(sender)
  if (!last) return intent

  const det = detectIntent(text)
  const dateEntity = intent.entities?.date || det.entities?.date

  if (
    last.type === 'reminder' &&
    dateEntity &&
    (isFollowUpUpdatePhrase(text) ||
      intent.intent === INTENTS.REMINDER_CREATE ||
      intent.intent === INTENTS.UNKNOWN ||
      intent.intent === INTENTS.REMINDER_UPDATE ||
      intent.intent === INTENTS.REMINDER_RESCHEDULE)
  ) {
    return {
      ...intent,
      intent: INTENTS.REMINDER_RESCHEDULE,
      entities: scrubCorrectionEntities({ ...det.entities, ...intent.entities, date: dateEntity }),
      confidence: Math.max(Number(intent.confidence) || 0, 0.9),
      lastEntityId: last.id,
      ai_intent: 'UPDATE_REMINDER',
      execution_intent: INTENTS.REMINDER_RESCHEDULE
    }
  }

  if (last.type === 'subscription') {
    const day =
      intent.entities?.renewalDay ||
      extractDayFromText(text) ||
      (intent.entities?.date?.day ? Number(intent.entities.date.day) : null)
    if (
      day &&
      (isFollowUpUpdatePhrase(text) ||
        intent.intent === INTENTS.SUBSCRIPTION_UPDATE ||
        /\b\d{1,2}(?:st|nd|rd|th)?\b/i.test(text))
    ) {
      return {
        ...intent,
        intent: INTENTS.SUBSCRIPTION_UPDATE,
        entities: { ...intent.entities, renewalDay: day },
        confidence: 0.9,
        lastEntityId: last.id
      }
    }
  }

  return intent
}

module.exports = { coerceIntentForLastEntity, extractDayFromText, isFollowUpUpdatePhrase }
