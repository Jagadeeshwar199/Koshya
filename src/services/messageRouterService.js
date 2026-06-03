const { INTENTS, detectIntent } = require('./intentService')
const { handleSubscriptionMessage } = require('./subscriptionFlowService')
const { getPending } = require('./pendingSubscriptionService')
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
  handleDeleteEntityIntent,
  handleSubscriptionDeleteIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent,
  WELCOME_TEXT
} = require('../controllers/queryController')
const {
  handleDeleteConfirm,
  handleDeleteCancel,
  handleListMore
} = require('../controllers/paginationController')
const logger = require('../../utils/logger')

async function routeWhatsAppMessage(sender, text, options = {}) {
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
    const isFreshReminder =
      /\bremind\s+me\b/i.test(text) && intent.entities.date?.kind === 'offset'
    if (isFreshReminder) {
      await clearState(sender)
    } else if (intent.entities.date || pendingState.draftEntities) {
      return handleReminderCreateTimeFollowUp(
        sender,
        pendingState.draftMessage,
        text,
        pendingState.draftEntities
      )
    } else {
      await clearState(sender)
    }
  }

  const intent = detectIntent(text)

  if (
    intent.confidence < 0.65 &&
    intent.intent !== INTENTS.UNKNOWN &&
    intent.intent !== INTENTS.SUBSCRIPTION_CREATE &&
    intent.intent !== INTENTS.REMINDER_CREATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_DELETE &&
    intent.intent !== INTENTS.REMINDER_RESCHEDULE &&
    intent.intent !== INTENTS.REMINDER_CANCEL
  ) {
    return handleClarifyIntent(sender, intent)
  }

  if (intent.intent === INTENTS.CONFIRM && !options.skipConfirmAck) {
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

  if (intent.intent === INTENTS.DELETE_ENTITY) {
    return handleDeleteEntityIntent(sender, intent)
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

  const pendingSubscription = await getPending(sender)
  if (pendingSubscription) {
    const result = await handleSubscriptionMessage(sender, text)
    return { ...result, intent: INTENTS.SUBSCRIPTION_CREATE }
  }

  return handleUnknownIntent(sender, intent, text)
}

module.exports = {
  routeWhatsAppMessage
}
