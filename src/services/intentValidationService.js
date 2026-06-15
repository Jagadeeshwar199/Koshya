const { INTENTS, needsReminderSubjectPrompt } = require('./intentService')
const { isValidAmount, isValidTimeEntity } = require('../utils/inputValidation')

function validateIntent(intent, text) {
  if (!intent?.intent) {
    return { passed: false, error: 'missing_intent' }
  }
  if (intent.intent === INTENTS.UNKNOWN) {
    return { passed: false, error: 'unknown_intent' }
  }
  if (intent.intent === INTENTS.REMINDER_CREATE && needsReminderSubjectPrompt(text, intent.entities)) {
    return { passed: false, error: 'missing_reminder_subject' }
  }
  if (intent.entities?.amount != null && !isValidAmount(intent.entities.amount)) {
    return { passed: false, error: 'invalid_amount' }
  }
  if (intent.entities?.date?.time && !isValidTimeEntity(intent.entities.date.time)) {
    return { passed: false, error: 'invalid_time' }
  }
  if (
    (intent.intent === INTENTS.REMINDER_RESCHEDULE || intent.intent === INTENTS.REMINDER_UPDATE) &&
    !intent.lastEntityId &&
    !intent.entities?.date
  ) {
    return { passed: false, error: 'missing_update_target' }
  }
  return { passed: true, error: null }
}

module.exports = { validateIntent }
