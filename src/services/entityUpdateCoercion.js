const { INTENTS, detectIntent } = require('./intentService')
const { getLastEntity } = require('./entityContextService')

function extractDayFromText(text) {
  const m = String(text || '').match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i)
  const n = m ? Number(m[1]) : null
  return n >= 1 && n <= 31 ? n : null
}

function isFollowUpUpdatePhrase(text) {
  return /^(sorry|actually|oops|change|move|make it)\b/i.test(String(text || '').trim())
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
      entities: { ...det.entities, ...intent.entities, date: dateEntity },
      confidence: Math.max(Number(intent.confidence) || 0, 0.9),
      lastEntityId: last.id
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
