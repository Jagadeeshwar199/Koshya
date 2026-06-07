const { INTENTS, detectIntent, detectClauseIntents } = require('./intentService')
const { handleSubscriptionMessage } = require('./subscriptionFlowService')

function isBlockedSubscriptionIntent(intent, text = '') {
  const i = intent?.intent
  const t = String(text || intent?.rawText || '').trim().toLowerCase()
  if (/^(show|list)\s+(?:my\s+)?(?:all\s+)?subscriptions?\b/.test(t)) return true
  if (/^delete\s+all\s+reminders?\b/.test(t)) return true
  if (/^(hi|hello|start|help)\b/.test(t)) return true
  if (!i || i === INTENTS.UNKNOWN) return /^(delete|remove|cancel|show|list|help)\b/.test(t)
  if (i === INTENTS.HELP || i === INTENTS.CANCEL || i === INTENTS.LIST_MORE) return true
  if (i.endsWith('_QUERY') || i.endsWith('_DELETE') || i === INTENTS.DELETE_ENTITY) return true
  if (i === INTENTS.REMINDER_CANCEL || i === INTENTS.SUBSCRIPTION_EXPIRY) return true
  return false
}
const { getPending, clearPending } = require('./pendingSubscriptionService')
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
  handleClarifyIntent,
  handleClarifyUpdate,
  handlePendingConfirmationDecline
} = require('../controllers/queryController')
const {
  handleListMore
} = require('../controllers/paginationController')
const logger = require('../../utils/logger')
const {
  isAdminPhone,
  parseAdminCommand,
  handleParserAdminCommand
} = require('./parserTelemetryService')
const intentPipeline = require('./intentPipelineService')
const { useLegacyEngine, splitClauses } = require('../detection/detectionEngine')
const { detectAndPlan } = require('../detection/detectionEngine')
const { coerceIntentForLastEntity, CLARIFY_UPDATE } = require('./entityUpdateCoercion')
const {
  getPendingConfirmation,
  clearPendingConfirmation,
  isExecutablePendingOverrideIntent,
  resolvePendingAction,
  isGreetingMessage,
  shouldApplyPendingConfirmation,
  isPositiveConfirmation,
  isNegativeConfirmation
} = require('./pendingConfirmationService')
const {
  tryStartDeleteFlow,
  handleDeleteMenuReply,
  handleDeletePickReply,
  handlePendingDeleteReply
} = require('./deleteFlowService')
async function resolveIntent(ctx, text) {
  if (useLegacyEngine()) {
    return ctx ? intentPipeline.stageDetect(ctx, text) : detectIntent(text)
  }
  const det = await detectAndPlan(text, ctx)
  if (ctx) ctx.lastDetection = det
  return det.intent
}

async function routeDetectedIntent(sender, text, intent, options = {}, meta = {}) {
  if (meta.clarificationText) {
    const { handleDetectionClarify } = require('../controllers/queryController')
    return handleDetectionClarify(sender, intent, meta.clarificationText)
  }

  intent = await coerceIntentForLastEntity(sender, intent, text)

  if (intent.intent === CLARIFY_UPDATE) {
    return handleClarifyUpdate(sender, intent)
  }

  if (meta.validationFailed) {
    if (
      intent.intent !== INTENTS.UNKNOWN &&
      (intent.lastEntityId ||
        intent.intent === INTENTS.REMINDER_RESCHEDULE ||
        intent.intent === INTENTS.SUBSCRIPTION_UPDATE)
    ) {
      meta = { ...meta, validationFailed: false }
    }
  }

  if (meta.validationFailed) {
    if (meta.validationError === 'missing_reminder_subject') {
      return handleReminderCreateIntent(sender, text, intent)
    }
    return handleClarifyIntent(sender, intent)
  }

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
    intent.intent !== INTENTS.REMINDER_UPDATE &&
    intent.intent !== INTENTS.REMINDER_CANCEL &&
    intent.intent !== INTENTS.SUBSCRIPTION_UPDATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_EXPIRY
  ) {
    return handleClarifyIntent(sender, intent)
  }

  if (intent.intent === INTENTS.CONFIRM && !options.skipConfirmAck) {
    return { ok: true, intent: intent.intent, replySent: (await sendWhatsAppMessage(sender, '👍')).success }
  }

  if (intent.intent === INTENTS.LIST_MORE) {
    return handleListMore(sender)
  }

  if (intent.intent === INTENTS.SUBSCRIPTION_CREATE) {
    const cmd = detectIntent(text)
    if (isBlockedSubscriptionIntent(cmd, text)) {
      return routeDetectedIntent(sender, text, cmd, options, meta)
    }
    const saved = await handleSubscriptionMessage(sender, text)
    if (saved.blocked) {
      return routeDetectedIntent(sender, text, cmd, options, meta)
    }
    return { ...saved, intent: intent.intent }
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
    const cmd = detectIntent(text)
    if (isBlockedSubscriptionIntent(cmd, text)) {
      await clearPending(sender)
      return routeDetectedIntent(sender, text, cmd, options, meta)
    }
    const saved = await handleSubscriptionMessage(sender, text)
    if (saved.blocked) {
      return routeDetectedIntent(sender, text, cmd, options, meta)
    }
    return { ...saved, intent: INTENTS.SUBSCRIPTION_CREATE }
  }

  return handleUnknownIntent(sender, intent, text)
}

async function routeWhatsAppMessage(sender, text, options = {}) {
  const adminCmd = parseAdminCommand(text)
  if (adminCmd && isAdminPhone(sender)) {
    return handleParserAdminCommand(sender, adminCmd)
  }
  return intentPipeline.runPipeline(sender, text, (ctx) => routeWhatsAppMessageCore(sender, text, options, ctx))
}

async function routeWhatsAppMessageCore(sender, text, options = {}, ctx = null) {
  const pendingState = await getState(sender)

  const pendingConfirm = await getPendingConfirmation(sender)
  if (pendingConfirm) {
    const intent = await resolveIntent(ctx, text)
    if (isExecutablePendingOverrideIntent(intent)) {
      await clearPendingConfirmation(sender)
      if (ctx) {
        return intentPipeline.processClause(ctx, text, (_detected, meta) =>
          routeDetectedIntent(sender, text, intent, options, meta)
        )
      }
      return routeDetectedIntent(sender, text, intent, options)
    }
    if (intent.intent === INTENTS.CANCEL || isNegativeConfirmation(text)) {
      await clearPendingConfirmation(sender)
      return intentPipeline.stageExecute(ctx, 'update_decline', () =>
        handlePendingConfirmationDecline(sender)
      )
    }
    if (isGreetingMessage(text) || intent.intent === INTENTS.HELP) {
      await clearPendingConfirmation(sender)
      if (ctx) {
        return intentPipeline.processClause(ctx, text, (_detected, meta) =>
          routeDetectedIntent(sender, text, intent, options, meta)
        )
      }
      return routeDetectedIntent(sender, text, intent, options)
    }
    if (shouldApplyPendingConfirmation(intent, text)) {
      return intentPipeline.stageExecute(ctx, 'update_confirm', async () => {
        const updateIntent = await resolvePendingAction(sender, intent)
        if (!updateIntent) {
          return handleUnknownIntent(sender, { intent: INTENTS.UNKNOWN, entities: {} }, text)
        }
        return handleReminderUpdateIntent(sender, updateIntent)
      })
    }
    await clearPendingConfirmation(sender)
    if (ctx) {
      return intentPipeline.processClause(ctx, text, (_detected, meta) =>
        routeDetectedIntent(sender, text, intent, options, meta)
      )
    }
    return routeDetectedIntent(sender, text, intent, options)
  }

  if (pendingState?.action === 'pending_delete') {
    const intent = await resolveIntent(ctx, text)
    if (
      isExecutablePendingOverrideIntent(intent) ||
      isGreetingMessage(text) ||
      intent.intent === INTENTS.HELP ||
      (!isPositiveConfirmation(text) && !isNegativeConfirmation(text))
    ) {
      await clearState(sender)
      if (ctx) {
        return intentPipeline.processClause(ctx, text, (_detected, meta) =>
          routeDetectedIntent(sender, text, intent, options, meta)
        )
      }
      return routeDetectedIntent(sender, text, intent, options)
    }
    return intentPipeline.stageExecute(ctx, 'delete_confirm', () =>
      handlePendingDeleteReply(sender, text, pendingState)
    )
  }

  if (pendingState?.action === 'delete_menu') {
    return intentPipeline.stageExecute(ctx, 'delete_menu', () => handleDeleteMenuReply(sender, text))
  }

  if (pendingState?.action === 'delete_pick') {
    return intentPipeline.stageExecute(ctx, 'delete_pick', () =>
      handleDeletePickReply(sender, text, pendingState)
    )
  }

  const deleteStart = await tryStartDeleteFlow(sender, text)
  if (deleteStart) {
    return intentPipeline.stageExecute(ctx, 'delete_start', () => deleteStart)
  }

  if (pendingState?.action === 'awaiting_reminder_time') {
    const intent = await resolveIntent(ctx, text)
    if (intent.entities.date) {
      return intentPipeline.stageExecute(ctx, 'reminder_time_followup', () =>
        handleReminderTimeFollowUp(sender, intent.entities.date)
      )
    }
    await clearState(sender)
  }

  if (pendingState?.action === 'awaiting_reminder_create_time' && pendingState.draftMessage) {
    const intent = await resolveIntent(ctx, text)
    const isFreshReminder =
      /\bremind\s+me\b/i.test(text) && intent.entities.date?.kind === 'offset'
    if (isFreshReminder) {
      await clearState(sender)
    } else if (intent.entities.date || pendingState.draftEntities) {
      return intentPipeline.stageExecute(ctx, 'reminder_create_time', () =>
        handleReminderCreateTimeFollowUp(
          sender,
          pendingState.draftMessage,
          text,
          pendingState.draftEntities
        )
      )
    } else {
      await clearState(sender)
    }
  }

  const clauses = useLegacyEngine()
    ? detectClauseIntents(text)
    : splitClauses(text).map((rawText) => ({ rawText, intent: null }))
  if (clauses.length > 1) {
    logger.info('intent.multi', { userPhone: sender, count: clauses.length })
    let last
    for (const clause of clauses) {
      const run = (intent, meta) => routeDetectedIntent(sender, clause.rawText || text, intent, options, meta)
      last = ctx
        ? await intentPipeline.processClause(ctx, clause.rawText || text, run)
        : await run(await resolveIntent(null, clause.rawText || text), {})
    }
    return { ok: true, intent: 'MULTI', clauses: clauses.length, last }
  }

  if (ctx) {
    return intentPipeline.processClause(ctx, text, (intent, meta) =>
      routeDetectedIntent(sender, text, intent, options, meta)
    )
  }

  const intent = await resolveIntent(ctx, text)
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
