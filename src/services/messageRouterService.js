const { INTENTS, detectIntent, detectClauseIntents } = require('./intentService')
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
  handleSubscriptionExpiryIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent
} = require('../controllers/queryController')
const {
  handleDeleteConfirm,
  handleDeleteCancel,
  handleListMore
} = require('../controllers/paginationController')
const logger = require('../../utils/logger')
const {
  isAdminPhone,
  parseAdminCommand,
  handleParserAdminCommand,
  logIncomingMessage
} = require('./parserTelemetryService')

async function routeDetectedIntent(sender, text, intent, options = {}) {
  if (intent.entities.clarify === 'short') {
    return handleUnknownIntent(sender, intent, text)
  }

  if (
    intent.confidence < 0.65 &&
    intent.intent !== INTENTS.UNKNOWN &&
    intent.intent !== INTENTS.SUBSCRIPTION_CREATE &&
    intent.intent !== INTENTS.REMINDER_CREATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_DELETE &&
    intent.intent !== INTENTS.REMINDER_RESCHEDULE &&
    intent.intent !== INTENTS.REMINDER_CANCEL &&
    intent.intent !== INTENTS.SUBSCRIPTION_EXPIRY
  ) {
    return handleClarifyIntent(sender, intent)
  }

  if (intent.intent === INTENTS.CONFIRM && !options.skipConfirmAck) {
    const reply = await sendWhatsAppMessage(sender, '👍')
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  if (intent.intent === INTENTS.LIST_MORE) {
    return handleListMore(sender)
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_CREATE) {
    return { ...(await handleSubscriptionMessage(sender, text)), intent: intent.intent }
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

  if (intent.intent === INTENTS.SUBSCRIPTION_EXPIRY) {
    return handleSubscriptionExpiryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_CREATE) {
    return handleReminderCreateIntent(sender, text, intent)
  }

  if (intent.intent === INTENTS.REMINDER_UPDATE || intent.intent === INTENTS.REMINDER_RESCHEDULE) {
    return handleReminderUpdateIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_CANCEL) {
    return handleReminderCancelIntent(sender, intent)
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_QUERY) {
    return handleSubscriptionQueryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.REMINDER_QUERY) {
    return handleReminderQueryIntent(sender, intent)
  }

  if (intent.intent === INTENTS.HELP) {
    return handleHelpIntent(sender, intent)
  }

  const pendingSubscription = await getPending(sender)
  if (pendingSubscription) {
    return { ...(await handleSubscriptionMessage(sender, text)), intent: INTENTS.SUBSCRIPTION_CREATE }
  }

  return handleUnknownIntent(sender, intent, text)
}

async function routeWhatsAppMessage(sender, text, options = {}) {
  const adminCmd = parseAdminCommand(text)
  if (adminCmd && isAdminPhone(sender)) {
    return handleParserAdminCommand(sender, adminCmd)
  }
  return logIncomingMessage(sender, text, () => routeWhatsAppMessageCore(sender, text, options))
}

async function routeWhatsAppMessageCore(sender, text, options = {}) {
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

  const clauses = detectClauseIntents(text)
  if (clauses.length > 1) {
    logger.info('intent.multi', { userPhone: sender, count: clauses.length })
    let last
    for (const clause of clauses) {
      last = await routeDetectedIntent(sender, clause.rawText || text, clause, options)
    }
    return { ok: true, intent: 'MULTI', clauses: clauses.length, last }
  }

  const intent = detectIntent(text)
  logger.info('intent.detected', {
    userPhone: sender,
    intent: intent.intent,
    confidence: intent.confidence,
    entities: intent.entities
  })

  return routeDetectedIntent(sender, text, intent, options)
}

module.exports = {
  routeWhatsAppMessage,
  routeDetectedIntent
}
