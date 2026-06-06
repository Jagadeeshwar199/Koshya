const { getState, setState, clearState } = require('./conversationStateService')

const UPDATE_INTENTS = new Set(['REMINDER_RESCHEDULE', 'REMINDER_UPDATE', 'SUBSCRIPTION_UPDATE'])

async function getLastEntity(userPhone) {
  const s = await getState(userPhone)
  if (!s?.last_entity_id) return null
  return { id: s.last_entity_id, type: s.last_entity_type }
}

async function getEntityContextForAI(userPhone) {
  const s = await getState(userPhone)
  if (!s?.last_entity_type) return null
  return {
    last_entity_id: s.last_entity_id,
    last_entity_type: s.last_entity_type,
    last_action: s.last_action || null,
    last_entity_title: s.last_entity_title || null,
    last_entity_time: s.last_entity_time || null
  }
}

async function setLastEntity(userPhone, type, id, meta = {}) {
  const s = (await getState(userPhone)) || {}
  await setState(userPhone, {
    ...s,
    last_entity_id: id,
    last_entity_type: type,
    last_action: meta.action || 'CREATE',
    last_entity_title: meta.title ?? null,
    last_entity_time: meta.time ?? null
  })
}

function attachLastEntityId(intent, conversationState) {
  if (!intent || !conversationState?.last_entity_id) return intent
  if (!UPDATE_INTENTS.has(intent.intent)) return intent
  return { ...intent, lastEntityId: conversationState.last_entity_id }
}

async function clearDialogueState(userPhone) {
  const s = await getState(userPhone)
  if (s?.last_entity_id) {
    await setState(userPhone, {
      last_entity_id: s.last_entity_id,
      last_entity_type: s.last_entity_type,
      last_action: s.last_action,
      last_entity_title: s.last_entity_title,
      last_entity_time: s.last_entity_time
    })
  } else await clearState(userPhone)
}

module.exports = {
  getLastEntity,
  getEntityContextForAI,
  setLastEntity,
  attachLastEntityId,
  clearDialogueState
}
