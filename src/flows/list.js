/**
 * List/query flow — reminders, subscriptions, help, pagination.
 */
const { INTENTS } = require('../services/intentService')
const { handleReminderQueryIntent } = require('../controllers/reminderController')
const {
  handleSubscriptionQueryIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent,
  handleDetectionClarify
} = require('../controllers/queryController')
const { handleListMore } = require('../controllers/paginationController')
const { sendWhatsAppMessage } = require('../services/whatsappService')

async function executeList(sender, intent, text, meta = {}) {
  if (meta.clarificationText) {
    return handleDetectionClarify(sender, intent, meta.clarificationText)
  }

  if (intent.entities?.clarify === 'short') {
    return handleUnknownIntent(sender, intent, text)
  }

  if (
    intent.confidence < 0.65 &&
    intent.intent !== INTENTS.UNKNOWN &&
    intent.intent !== INTENTS.SUBSCRIPTION_CREATE &&
    intent.intent !== INTENTS.REMINDER_CREATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_DELETE &&
    intent.intent !== INTENTS.REMINDER_RESCHEDULE &&
    intent.intent !== INTENTS.REMINDER_UPDATE &&
    intent.intent !== INTENTS.REMINDER_CANCEL &&
    intent.intent !== INTENTS.SUBSCRIPTION_UPDATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_EXPIRY
  ) {
    return handleClarifyIntent(sender, intent)
  }

  if (meta.validationFailed) {
    return handleClarifyIntent(sender, intent)
  }

  if (intent.intent === INTENTS.CONFIRM && !meta.skipConfirmAck) {
    return { ok: true, intent: intent.intent, replySent: (await sendWhatsAppMessage(sender, '👍')).success }
  }

  if (intent.intent === INTENTS.LIST_MORE) return handleListMore(sender)
  if (intent.intent === INTENTS.SUBSCRIPTION_QUERY) return handleSubscriptionQueryIntent(sender, intent)
  if (intent.intent === INTENTS.REMINDER_QUERY) return handleReminderQueryIntent(sender, intent)
  if (intent.intent === INTENTS.HELP) return handleHelpIntent(sender, intent)

  return handleUnknownIntent(sender, intent, text)
}

module.exports = { executeList }
