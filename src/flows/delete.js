/**
 * Delete flow — menu, pick, bulk confirm, entity delete.
 */
const { INTENTS } = require('../services/intentService')
const { handleReminderCancelIntent } = require('../controllers/reminderController')
const { handleDeleteEntityIntent } = require('../controllers/queryController')
const {
  tryStartDeleteFlow,
  handleDeleteMenuReply,
  handleDeletePickReply,
  handlePendingDeleteReply
} = require('../services/deleteFlowService')

async function tryStart(sender, text) {
  return tryStartDeleteFlow(sender, text)
}

async function executeMenu(sender, text) {
  return handleDeleteMenuReply(sender, text)
}

async function executePick(sender, text, state) {
  return handleDeletePickReply(sender, text, state)
}

async function executeBulkConfirm(sender, text, state) {
  return handlePendingDeleteReply(sender, text, state)
}

async function executeIntent(sender, intent) {
  if (intent.intent === INTENTS.REMINDER_CANCEL) {
    return handleReminderCancelIntent(sender, intent)
  }
  if (intent.intent === INTENTS.DELETE_ENTITY) {
    return handleDeleteEntityIntent(sender, intent)
  }
  return null
}

module.exports = {
  tryStart,
  executeMenu,
  executePick,
  executeBulkConfirm,
  executeIntent
}
