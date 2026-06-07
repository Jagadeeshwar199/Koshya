const { getState, setState } = require('./conversationStateService')

const PENDING_TTL_MS = 10 * 60 * 1000
const CONFIRM_RE = /^(yes|yep|ok|okay|confirm)$/i
const DECLINE_RE = /^(no|nope|cancel)$/i

function isConfirmReply(text) {
  return CONFIRM_RE.test(String(text || '').trim())
}

function isDeclineReply(text) {
  return DECLINE_RE.test(String(text || '').trim())
}

async function setPendingConfirmation(userPhone, { pending_intent, target_id, proposed_changes }) {
  const s = (await getState(userPhone)) || {}
  await setState(userPhone, {
    ...s,
    pending_confirmation: true,
    pending_intent,
    target_id,
    proposed_changes: proposed_changes || {},
    pending_at: new Date().toISOString()
  })
}

async function getPendingConfirmation(userPhone) {
  const s = await getState(userPhone)
  if (!s?.pending_confirmation) return null
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
  delete next.pending_confirmation
  delete next.pending_intent
  delete next.target_id
  delete next.proposed_changes
  delete next.pending_at
  await setState(userPhone, {
    ...next,
    pending_confirmation: undefined,
    pending_intent: undefined,
    target_id: undefined,
    proposed_changes: undefined,
    pending_at: undefined
  })
}

async function buildIntentFromPending(userPhone) {
  const pending = await getPendingConfirmation(userPhone)
  if (!pending) return null
  await clearPendingConfirmation(userPhone)
  return {
    intent: pending.pending_intent,
    entities: pending.proposed_changes,
    lastEntityId: pending.target_id,
    ai_intent: 'UPDATE_REMINDER',
    execution_intent: pending.pending_intent,
    confidence: 0.95
  }
}

module.exports = {
  PENDING_TTL_MS,
  isConfirmReply,
  isDeclineReply,
  setPendingConfirmation,
  getPendingConfirmation,
  clearPendingConfirmation,
  buildIntentFromPending
}
