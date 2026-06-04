const { INTENTS, needsReminderSubjectPrompt } = require('./intentService')

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
  return { passed: true, error: null }
}

module.exports = { validateIntent }
