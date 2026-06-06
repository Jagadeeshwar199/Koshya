const { getState, setState, clearState } = require('./conversationStateService')

async function getLastEntity(userPhone) {
  const s = await getState(userPhone)
  if (!s?.last_entity_id) return null
  return { id: s.last_entity_id, type: s.last_entity_type }
}

async function setLastEntity(userPhone, type, id) {
  const s = (await getState(userPhone)) || {}
  await setState(userPhone, {
    ...s,
    last_entity_id: id,
    last_entity_type: type
  })
}

async function clearDialogueState(userPhone) {
  const last = await getLastEntity(userPhone)
  if (last) await setState(userPhone, { last_entity_id: last.id, last_entity_type: last.type })
  else await clearState(userPhone)
}

module.exports = { getLastEntity, setLastEntity, clearDialogueState }
