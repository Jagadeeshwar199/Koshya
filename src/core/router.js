/**
 * Flow router — routes normalized events to independent flows.
 * Execution does not depend on analytics/classification scores.
 */
const { INTENTS, detectIntent, detectClauseIntents } = require('../services/intentService')
const { getState, clearState } = require('../services/conversationStateService')
const intentPipeline = require('../services/intentPipelineService')
const { useLegacyEngine, splitClauses, detectAndPlan } = require('../detection/detectionEngine')
const { coerceIntentForLastEntity, CLARIFY_UPDATE } = require('../services/entityUpdateCoercion')
const {
  getPendingConfirmation,
  clearPendingConfirmation,
  isExecutablePendingOverrideIntent,
  resolvePendingAction,
  isGreetingMessage,
  shouldApplyPendingConfirmation,
  isPositiveConfirmation,
  isNegativeConfirmation
} = require('../services/pendingConfirmationService')
const { handlePendingConfirmationDecline } = require('../controllers/queryController')
const { selectFlowName, executeFlow } = require('../flows')
const createFlow = require('../flows/create')
const deleteFlow = require('../flows/delete')
const logger = require('../../utils/logger')

async function resolveIntent(ctx, text) {
  if (useLegacyEngine()) {
    return ctx ? intentPipeline.stageDetect(ctx, text) : detectIntent(text)
  }
  const det = await detectAndPlan(text, ctx)
  if (ctx) ctx.lastDetection = det
  return det.intent
}

function intentFromParse(parseResult) {
  return {
    intent: parseResult.intent,
    confidence: parseResult.confidence,
    rawText: parseResult.rawMessage,
    entities: parseResult.entities || {},
    domain: parseResult.domain,
    action: parseResult.action
  }
}

async function routeToFlow(sender, text, intent, options = {}, meta = {}) {
  intent = await coerceIntentForLastEntity(sender, intent, text)

  if (intent.intent === CLARIFY_UPDATE) {
    return createFlow.executeClarifyUpdate(sender, intent)
  }

  const flowName = selectFlowName(intent.intent)
  const reroute = (cmd, m = {}) => routeToFlow(sender, text, cmd, options, m)
  return executeFlow(flowName, sender, text, intent, { meta, reroute })
}

async function routeMessage(sender, text, options = {}, ctx = null, parseResult = null) {
  const pendingState = await getState(sender)

  const pendingConfirm = await getPendingConfirmation(sender)
  if (pendingConfirm) {
    const intent = await resolveIntent(ctx, text)
    if (isExecutablePendingOverrideIntent(intent)) {
      await clearPendingConfirmation(sender)
      if (ctx) {
        return intentPipeline.processClause(ctx, text, (_d, meta) =>
          routeToFlow(sender, text, intent, options, meta)
        )
      }
      return routeToFlow(sender, text, intent, options)
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
        return intentPipeline.processClause(ctx, text, (_d, meta) =>
          routeToFlow(sender, text, intent, options, meta)
        )
      }
      return routeToFlow(sender, text, intent, options)
    }
    if (shouldApplyPendingConfirmation(intent, text)) {
      return intentPipeline.stageExecute(ctx, 'update_confirm', async () => {
        const updateIntent = await resolvePendingAction(sender, intent)
        if (!updateIntent) {
          return executeFlow('list', sender, text, { intent: INTENTS.UNKNOWN, entities: {} }, {})
        }
        return createFlow.executeUpdateConfirm(sender, updateIntent)
      })
    }
    await clearPendingConfirmation(sender)
    if (ctx) {
      return intentPipeline.processClause(ctx, text, (_d, meta) =>
        routeToFlow(sender, text, intent, options, meta)
      )
    }
    return routeToFlow(sender, text, intent, options)
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
        return intentPipeline.processClause(ctx, text, (_d, meta) =>
          routeToFlow(sender, text, intent, options, meta)
        )
      }
      return routeToFlow(sender, text, intent, options)
    }
    return intentPipeline.stageExecute(ctx, 'delete_confirm', () =>
      deleteFlow.executeBulkConfirm(sender, text, pendingState)
    )
  }

  if (pendingState?.action === 'delete_menu') {
    return intentPipeline.stageExecute(ctx, 'delete_menu', () =>
      deleteFlow.executeMenu(sender, text)
    )
  }

  if (pendingState?.action === 'delete_pick') {
    return intentPipeline.stageExecute(ctx, 'delete_pick', () =>
      deleteFlow.executePick(sender, text, pendingState)
    )
  }

  const deleteStart = await deleteFlow.tryStart(sender, text)
  if (deleteStart) {
    return intentPipeline.stageExecute(ctx, 'delete_start', () => deleteStart)
  }

  if (pendingState?.action === 'awaiting_reminder_time') {
    const intent = await resolveIntent(ctx, text)
    if (intent.entities.date) {
      return intentPipeline.stageExecute(ctx, 'reminder_time_followup', () =>
        createFlow.executeTimeFollowUp(sender, intent)
      )
    }
    await createFlow.clearAwaitingTime(sender)
  }

  if (pendingState?.action === 'awaiting_reminder_create_time' && pendingState.draftMessage) {
    const intent = await resolveIntent(ctx, text)
    const isFreshReminder =
      /\bremind\s+me\b/i.test(text) && intent.entities.date?.kind === 'offset'
    if (isFreshReminder) {
      await clearState(sender)
    } else if (intent.entities.date || pendingState.draftEntities) {
      return intentPipeline.stageExecute(ctx, 'reminder_create_time', () =>
        createFlow.executeCreateTimeFollowUp(sender, pendingState, text)
      )
    } else {
      await clearState(sender)
    }
  }

  const subscriptionFlow = require('../flows/subscription')
  const pendingSub = await subscriptionFlow.executePending(sender, text, (cmd) =>
    routeToFlow(sender, text, cmd, options)
  )
  if (pendingSub) return pendingSub

  const clauses = useLegacyEngine()
    ? detectClauseIntents(text)
    : splitClauses(text).map((rawText) => ({ rawText, intent: null }))
  if (clauses.length > 1) {
    logger.info('intent.multi', { userPhone: sender, count: clauses.length })
    let last
    for (const clause of clauses) {
      const run = (intent, meta) => routeToFlow(sender, clause.rawText || text, intent, options, meta)
      last = ctx
        ? await intentPipeline.processClause(ctx, clause.rawText || text, run)
        : await run(await resolveIntent(null, clause.rawText || text), {})
    }
    return { ok: true, intent: 'MULTI', clauses: clauses.length, last }
  }

  if (ctx) {
    return intentPipeline.processClause(ctx, text, (intent, meta) =>
      routeToFlow(sender, text, intent, options, meta)
    )
  }

  const intent = parseResult
    ? intentFromParse(parseResult)
    : await resolveIntent(ctx, text)

  logger.info('intent.detected', {
    userPhone: sender,
    intent: intent.intent,
    confidence: intent.confidence,
    entities: intent.entities
  })
  return routeToFlow(sender, text, intent, options)
}

module.exports = { routeMessage, routeToFlow, resolveIntent, intentFromParse }
