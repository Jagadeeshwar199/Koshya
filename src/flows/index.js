/**
 * Flow registry — one handler per capability.
 */
const { INTENTS } = require('../services/intentService')
const createFlow = require('./create')
const listFlow = require('./list')
const deleteFlow = require('./delete')
const subscriptionFlow = require('./subscription')

function selectFlowName(intentName) {
  if (
    intentName === INTENTS.REMINDER_CREATE ||
    intentName === INTENTS.REMINDER_UPDATE ||
    intentName === INTENTS.REMINDER_RESCHEDULE
  ) {
    return 'create'
  }
  if (
    intentName === INTENTS.REMINDER_QUERY ||
    intentName === INTENTS.SUBSCRIPTION_QUERY ||
    intentName === INTENTS.HELP ||
    intentName === INTENTS.LIST_MORE ||
    intentName === INTENTS.UNKNOWN ||
    intentName === INTENTS.CONFIRM
  ) {
    return 'list'
  }
  if (
    intentName === INTENTS.REMINDER_CANCEL ||
    intentName === INTENTS.DELETE_ENTITY
  ) {
    return 'delete'
  }
  if (
    intentName === INTENTS.SUBSCRIPTION_CREATE ||
    intentName === INTENTS.SUBSCRIPTION_UPDATE ||
    intentName === INTENTS.SUBSCRIPTION_DELETE ||
    intentName === INTENTS.SUBSCRIPTION_EXPIRY
  ) {
    return 'subscription'
  }
  return 'list'
}

async function executeFlow(flowName, sender, text, intent, options = {}) {
  const { meta = {}, reroute, event } = options

  if (flowName === 'create') {
    return createFlow.executeCreate(sender, text, intent, meta)
  }
  if (flowName === 'delete') {
    const byIntent = await deleteFlow.executeIntent(sender, intent)
    if (byIntent) return byIntent
    return listFlow.executeList(sender, intent, text, meta)
  }
  if (flowName === 'subscription') {
    const byIntent = await subscriptionFlow.executeIntent(sender, intent)
    if (byIntent) return byIntent
    if (intent.intent === INTENTS.SUBSCRIPTION_CREATE) {
      return subscriptionFlow.executeCreate(sender, text, intent, reroute)
    }
    return listFlow.executeList(sender, intent, text, meta)
  }
  return listFlow.executeList(sender, intent, text, { ...meta, event })
}

module.exports = { selectFlowName, executeFlow, createFlow, listFlow, deleteFlow, subscriptionFlow }
