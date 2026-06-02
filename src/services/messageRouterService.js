const { INTENTS, detectIntent } = require('./intentService')
const { handleSubscriptionMessage } = require('./subscriptionFlowService')
const { getState, clearState } = require('./conversationStateService')
const { sendWhatsAppMessage } = require('./whatsappService')
const {
  handleReminderCreateIntent,
  handleReminderCancelIntent,
  handleReminderUpdateIntent,
  handleReminderTimeFollowUp,
  handleReminderCreateTimeFollowUp,
  handleReminderQueryIntent
} = require('../controllers/reminderController')
const {
  handleSubscriptionDeleteIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent
} = require('../controllers/queryController')
const {
  handleDeleteConfirm,
  handleDeleteCancel,
  handleListMore
} = require('../controllers/paginationController')
const logger = require('../../utils/logger')

async function routeWhatsAppMessage(sender, text) {
  const pendingState = await getState(sender)

  if (pendingState?.action === 'confirm_delete') {
    const intent = detectIntent(text)

    if (intent.intent === INTENTS.CONFIRM) {
      return handleDeleteConfirm(sender, pendingState)
    }

    if (intent.intent === INTENTS.CANCEL) {
      return handleDeleteCancel(sender)
    }
  }

  if (pendingState?.action === 'awaiting_reminder_time') {
    const intent = detectIntent(text)
    if (intent.entities.date) {
      return handleReminderTimeFollowUp(sender, intent.entities.date)
    }
    await clearState(sender)
  }

  if (pendingState?.action === 'awaiting_reminder_create_time' && pendingState.draftMessage) {
    const intent = detectIntent(text)
    if (intent.entities.date) {
      return handleReminderCreateTimeFollowUp(
        sender,
        pendingState.draftMessage,
        text
      )
    }
    await clearState(sender)
  }

  const intent = detectIntent(text)

  if (intent.intent === INTENTS.CONFIRM) {
    const reply = await sendWhatsAppMessage(sender, '👍')
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  logger.info('intent.detected', {
    userPhone: sender,
    intent: intent.intent,
    confidence: intent.confidence,
    entities: intent.entities
  })

  if (intent.intent === INTENTS.LIST_MORE) {
    return handleListMore(sender)
  }

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

  if (intent.intent === INTENTS.SUBSCRIPTION_DELETE) {
    return handleSubscriptionDeleteIntent(sender, intent)
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_QUERY) {
    return handleSubscriptionQueryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_CREATE) {
    return handleReminderCreateIntent(sender, text, intent)
  }

  if (
    intent.intent === INTENTS.REMINDER_UPDATE ||
    intent.intent === INTENTS.REMINDER_RESCHEDULE
  ) {
    return handleReminderUpdateIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_CANCEL) {
    return handleReminderCancelIntent(sender, intent)
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
