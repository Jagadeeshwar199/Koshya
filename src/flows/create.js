/**
 * Create/update flow — reminders only. Subscription checks live in subscription flow.
 */
const { INTENTS } = require('../services/intentService')
const {
  handleReminderCreateIntent,
  handleReminderUpdateIntent,
  handleReminderTimeFollowUp,
  handleReminderCreateTimeFollowUp
} = require('../controllers/reminderController')
const { handleClarifyUpdate } = require('../controllers/queryController')
const { CLARIFY_UPDATE } = require('../services/entityUpdateCoercion')
const { clearState } = require('../services/conversationStateService')

async function executeUpdateConfirm(sender, intent) {
  return handleReminderUpdateIntent(sender, intent)
}

async function executeClarifyUpdate(sender, intent) {
  return handleClarifyUpdate(sender, intent)
}

async function executeCreate(sender, text, intent, meta = {}) {
  if (intent.intent === CLARIFY_UPDATE) {
    return executeClarifyUpdate(sender, intent)
  }
  if (intent.intent === INTENTS.REMINDER_UPDATE || intent.intent === INTENTS.REMINDER_RESCHEDULE) {
    return handleReminderUpdateIntent(sender, intent)
  }
  if (meta.validationFailed && meta.validationError === 'missing_reminder_subject') {
    return handleReminderCreateIntent(sender, text, intent)
  }
  return handleReminderCreateIntent(sender, text, intent)
}

async function executeTimeFollowUp(sender, intent) {
  return handleReminderTimeFollowUp(sender, intent.entities.date)
}

async function executeCreateTimeFollowUp(sender, state, text) {
  return handleReminderCreateTimeFollowUp(
    sender,
    state.draftMessage,
    text,
    state.draftEntities
  )
}

async function clearAwaitingTime(sender) {
  await clearState(sender)
}

module.exports = {
  executeCreate,
  executeUpdateConfirm,
  executeClarifyUpdate,
  executeTimeFollowUp,
  executeCreateTimeFollowUp,
  clearAwaitingTime
}
