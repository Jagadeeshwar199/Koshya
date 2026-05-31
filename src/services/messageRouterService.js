const { INTENTS, detectIntent } = require('./intentService')
const { handleSubscriptionMessage } = require('../../services/subscriptionFlowService')
const {
  handleReminderCreateIntent,
  handleReminderQueryIntent
} = require('../controllers/reminderController')
const {
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent
} = require('../controllers/queryController')
const logger = require('../../utils/logger')

async function routeWhatsAppMessage(sender, text) {
  const intent = detectIntent(text)

  logger.info('intent.detected', {
    userPhone: sender,
    intent: intent.intent,
    confidence: intent.confidence,
    entities: intent.entities
  })

  if (intent.intent === INTENTS.SUBSCRIPTION_CREATE) {
    const result = await handleSubscriptionMessage(sender, text)
    return {
      ...result,
      intent: intent.intent
    }
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_UPDATE) {
    return handleSubscriptionUpdateIntent(sender, intent)
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_QUERY) {
    return handleSubscriptionQueryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_CREATE) {
    return handleReminderCreateIntent(sender, text, intent)
  }

  if (intent.intent === INTENTS.REMINDER_QUERY) {
    return handleReminderQueryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.HELP) {
    return handleHelpIntent(sender, intent)
  }

  return handleUnknownIntent(sender, intent)
}

module.exports = {
  routeWhatsAppMessage
}
