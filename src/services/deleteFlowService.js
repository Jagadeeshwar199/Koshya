const { getState, setState, clearState } = require('./conversationStateService')
const { sendWhatsAppMessage } = require('./whatsappService')
const { getActiveReminders, cancelReminder, unpackReminderMessage } = require('./reminderService')
const { getUserSubscriptions, archiveSubscription } = require('./subscriptionService')
const {
  formatReminderOption,
  formatReminderCancelConfirmation
} = require('../formatters/reminderFormatter')
const {
  isPositiveConfirmation,
  isNegativeConfirmation
} = require('./pendingConfirmationService')

const TTL_MS = 10 * 60 * 1000
const DELETE_MENU = `What should I delete?

1. Reminder
2. Subscription
3. Everything

Reply 1, 2, or 3.`

function expired(state) {
  return Date.now() - new Date(state?.pending_at || 0).getTime() > TTL_MS
}

function confirmPrompt(scope) {
  const labels = {
    all_reminders: 'all reminders',
    all_subscriptions: 'all subscriptions',
    everything: 'everything (reminders and subscriptions)'
  }
  return `⚠️ This will remove ${labels[scope]}.

Are you sure?
(yes/no)`
}

function parseDeleteAll(text) {
  const t = String(text || '').trim().toLowerCase()
  if (/^delete\s+all\s+reminders?$/.test(t)) return 'all_reminders'
  if (/^delete\s+all\s+subscriptions?$/.test(t)) return 'all_subscriptions'
  if (/^delete\s+(?:everything|all)$/.test(t)) return 'everything'
  return null
}

function isAmbiguousDelete(text) {
  const t = String(text || '').trim().toLowerCase()
  return (
    /^(?:delete|remove|cancel)$/.test(t) ||
    /^(?:delete|remove|cancel)\s+something$/.test(t)
  )
}

function parsePickDelete(text) {
  const m = String(text || '').trim().match(/^delete\s+(\d+|all)$/i)
  return m ? m[1].toLowerCase() : null
}

async function setDeleteMenu(userPhone) {
  await setState(userPhone, { action: 'delete_menu', pending_at: new Date().toISOString() })
}

async function setDeletePick(userPhone, listType, targets) {
  await setState(userPhone, {
    action: 'delete_pick',
    delete_list_type: listType,
    delete_targets: targets,
    pending_at: new Date().toISOString()
  })
}

async function setPendingDelete(userPhone, scope) {
  await setState(userPhone, {
    action: 'pending_delete',
    delete_scope: scope,
    pending_at: new Date().toISOString()
  })
}

async function showNumberedReminders(sender) {
  const reminders = await getActiveReminders(sender)
  if (!reminders.length) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(sender, 'No reminders to delete.')
    return { ok: true, replySent: reply.success }
  }
  const lines = reminders.map((r, i) => formatReminderOption(r, i))
  await setDeletePick(
    sender,
    'reminders',
    reminders.map((r) => ({ type: 'reminder', id: r.id }))
  )
  const reply = await sendWhatsAppMessage(
    sender,
    `Reminders:\n\n${lines.join('\n')}\n\nReply:\nDelete 1\nDelete all`
  )
  return { ok: true, replySent: reply.success }
}

async function showNumberedSubscriptions(sender) {
  const subs = await getUserSubscriptions(sender)
  if (!subs.length) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(sender, 'No subscriptions to delete.')
    return { ok: true, replySent: reply.success }
  }
  const lines = subs.map((s, i) => formatSubscriptionOption(s, i))
  await setDeletePick(
    sender,
    'subscriptions',
    subs.map((s) => ({ type: 'subscription', id: s.id }))
  )
  const reply = await sendWhatsAppMessage(
    sender,
    `Subscriptions:\n\n${lines.join('\n')}\n\nReply:\nDelete 1\nDelete all`
  )
  return { ok: true, replySent: reply.success }
}

async function startDeleteMenu(sender) {
  await setDeleteMenu(sender)
  const reply = await sendWhatsAppMessage(sender, DELETE_MENU)
  return { ok: true, intent: 'DELETE_FLOW', replySent: reply.success }
}

async function startPendingDeleteFlow(sender, scope) {
  await setPendingDelete(sender, scope)
  const reply = await sendWhatsAppMessage(sender, confirmPrompt(scope))
  return { ok: true, intent: 'DELETE_FLOW', pending_delete: scope, replySent: reply.success }
}

async function tryStartDeleteFlow(sender, text) {
  const scope = parseDeleteAll(text)
  if (scope) return startPendingDeleteFlow(sender, scope)
  if (isAmbiguousDelete(text)) return startDeleteMenu(sender)
  return null
}

async function deleteTarget(sender, target) {
  if (target.type === 'reminder') {
    const reminder = await cancelReminder(target.id)
    const reply = await sendWhatsAppMessage(sender, formatReminderCancelConfirmation(reminder))
    return { ok: true, replySent: reply.success }
  }
  const sub = await archiveSubscription(target.id)
  const reply = await sendWhatsAppMessage(sender, formatSubscriptionRemoved(sub))
  return { ok: true, replySent: reply.success }
}

async function handleDeleteMenuReply(sender, text) {
  const state = await getState(sender)
  if (expired(state)) {
    await clearState(sender)
    return startDeleteMenu(sender)
  }
  const t = String(text || '').trim().toLowerCase()
  if (/^(1|reminder|reminders)$/.test(t)) return showNumberedReminders(sender)
  if (/^(2|subscription|subscriptions)$/.test(t)) return showNumberedSubscriptions(sender)
  if (/^(3|everything|all)$/.test(t)) return startPendingDeleteFlow(sender, 'everything')
  const reply = await sendWhatsAppMessage(sender, `Reply 1, 2, or 3.\n\n${DELETE_MENU}`)
  return { ok: true, replySent: reply.success }
}

async function handleDeletePickReply(sender, text, state) {
  if (expired(state)) {
    await clearState(sender)
    return startDeleteMenu(sender)
  }
  const pick = parsePickDelete(text)
  if (!pick) {
    const reply = await sendWhatsAppMessage(sender, 'Reply Delete 1, Delete 2, or Delete all.')
    return { ok: true, replySent: reply.success }
  }
  if (pick === 'all') {
    const scope =
      state.delete_list_type === 'reminders' ? 'all_reminders' : 'all_subscriptions'
    return startPendingDeleteFlow(sender, scope)
  }
  const target = state.delete_targets?.[Number(pick) - 1]
  if (!target) {
    const reply = await sendWhatsAppMessage(sender, 'Invalid number. Try Delete 1 or Delete all.')
    return { ok: true, replySent: reply.success }
  }
  await clearState(sender)
  return deleteTarget(sender, target)
}

async function executeDeleteAll(sender, scope) {
  let count = 0
  if (scope === 'all_reminders' || scope === 'everything') {
    const reminders = await getActiveReminders(sender)
    for (const r of reminders) {
      await cancelReminder(r.id)
      count++
    }
  }
  if (scope === 'all_subscriptions' || scope === 'everything') {
    const subs = await getUserSubscriptions(sender)
    for (const s of subs) {
      await archiveSubscription(s.id)
      count++
    }
  }
  return count
}

async function handlePendingDeleteReply(sender, text, state) {
  if (expired(state)) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(sender, 'Confirmation expired. Try again.')
    return { ok: true, replySent: reply.success }
  }
  if (isPositiveConfirmation(text)) {
    await clearState(sender)
    await executeDeleteAll(sender, state.delete_scope)
    const labels = {
      all_reminders: 'All reminders removed',
      all_subscriptions: 'All subscriptions removed',
      everything: 'Everything removed'
    }
    const reply = await sendWhatsAppMessage(sender, `✅ ${labels[state.delete_scope]}.`)
    return { ok: true, pending_delete_confirmed: state.delete_scope, replySent: reply.success }
  }
  if (isNegativeConfirmation(text)) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(sender, 'Cancelled.')
    return { ok: true, cancelled: true, replySent: reply.success }
  }
  const reply = await sendWhatsAppMessage(sender, confirmPrompt(state.delete_scope))
  return { ok: true, replySent: reply.success }
}

async function showDeletePickFromCandidates(sender, candidates) {
  const lines = candidates.map((c, i) => {
    if (c.type === 'reminder') {
      const { title } = unpackReminderMessage(c.item.message)
      return `${i + 1}. ${title} reminder`
    }
    return `${i + 1}. ${c.item.serviceName}`
  })
  await setDeletePick(
    sender,
    'mixed',
    candidates.map((c) => ({ type: c.type, id: c.item.id }))
  )
  const reply = await sendWhatsAppMessage(
    sender,
    `Which one?\n\n${lines.join('\n')}\n\nReply:\nDelete 1\nDelete all`
  )
  return { ok: true, replySent: reply.success }
}

module.exports = {
  tryStartDeleteFlow,
  handleDeleteMenuReply,
  handleDeletePickReply,
  handlePendingDeleteReply,
  showDeletePickFromCandidates,
  startDeleteMenu,
  parseDeleteAll,
  isAmbiguousDelete
}
