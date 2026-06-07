const { getState, setState } = require('./conversationStateService')
const { isExecutablePendingOverrideIntent } = require('../intent/executableIntents')
const { INTENTS } = require('./intentService')

const PENDING_TTL_MS = 10 * 60 * 1000

function isGreetingMessage(text) {
  return /^(hi|hello|hey|start)$/i.test(String(text || '').trim())
}

function isPositiveConfirmation(text) {
  const t = String(text || '').trim().toLowerCase()
  return (
    /^(yes|y|ok|okay|confirm|sure|do it|delete them|proceed)$/.test(t) ||
    /^(yes|ok|sure)[,!\s]/.test(t)
  )
}

function isNegativeConfirmation(text) {
  const t = String(text || '').trim().toLowerCase()
  return /^(no|cancel|stop)$/.test(t) || /\bdon'?t\b/.test(t)
}

function shouldApplyPendingConfirmation(intent, text) {
  const t = String(text || '').trim()
  if (isGreetingMessage(t) || intent?.intent === INTENTS.HELP) return false
  if (isNegativeConfirmation(t) || intent?.intent === INTENTS.CANCEL) return false
  if (isPositiveConfirmation(t) || intent?.intent === INTENTS.CONFIRM) return true
  if (
    intent?.entities?.date &&
    intent.intent !== INTENTS.REMINDER_CREATE &&
    intent.intent !== INTENTS.SUBSCRIPTION_CREATE
  ) {
    return true
  }
  return false
}

async function setPendingConfirmation(userPhone, { pending_intent, target_id, proposed_changes }) {
  const s = (await getState(userPhone)) || {}
  await setState(userPhone, {
    ...s,
    pending_action: true,
    pending_intent,
    target_id,
    proposed_changes: proposed_changes || {},
    pending_at: new Date().toISOString()
  })
}

async function getPendingConfirmation(userPhone) {
  const s = await getState(userPhone)
  if (!s?.pending_action) return null
  const age = Date.now() - new Date(s.pending_at || 0).getTime()
  if (age > PENDING_TTL_MS) {
    await clearPendingConfirmation(userPhone)
    return null
  }
  return {
    pending_intent: s.pending_intent,
    target_id: s.target_id,
    proposed_changes: s.proposed_changes || {}
  }
}

async function clearPendingConfirmation(userPhone) {
  const s = await getState(userPhone)
  if (!s) return
  const next = { ...s }
  delete next.pending_action
  delete next.pending_intent
  delete next.target_id
  delete next.proposed_changes
  delete next.pending_at
  await setState(userPhone, {
    ...next,
    pending_action: undefined,
    pending_intent: undefined,
    target_id: undefined,
    proposed_changes: undefined,
    pending_at: undefined
  })
}

async function resolvePendingAction(userPhone, detectedIntent = {}) {
  const pending = await getPendingConfirmation(userPhone)
  if (!pending) return null
  await clearPendingConfirmation(userPhone)
  return {
    intent: pending.pending_intent,
    entities: { ...pending.proposed_changes, ...(detectedIntent.entities || {}) },
    lastEntityId: pending.target_id,
    ai_intent: 'UPDATE_REMINDER',
    execution_intent: pending.pending_intent,
    confidence: Math.max(Number(detectedIntent.confidence) || 0, 0.95),
    rawText: detectedIntent.rawText
  }
}

module.exports = {
  PENDING_TTL_MS,
  isExecutablePendingOverrideIntent,
  isGreetingMessage,
  isPositiveConfirmation,
  isNegativeConfirmation,
  shouldApplyPendingConfirmation,
  setPendingConfirmation,
  getPendingConfirmation,
  clearPendingConfirmation,
  resolvePendingAction
}
