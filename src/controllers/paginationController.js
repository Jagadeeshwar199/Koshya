const { getState, clearState } = require('../services/conversationStateService')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const {
  archiveSubscription,
  getUserSubscriptions
} = require('../services/subscriptionService')
const { getUserReminders } = require('../services/reminderService')
const {
  formatSubscription,
  formatSubscriptionRemoved
} = require('../formatters/subscriptionFormatter')
const {
  formatManualReminderSummary,
  formatSubscriptionReminderSummary
} = require('../formatters/reminderFormatter')

const PAGE_SIZE = 5

async function handleDeleteConfirm(sender, state) {
  await clearState(sender)

  try {
    const subscription = await archiveSubscription(state.subscriptionId)
    const reply = await sendWhatsAppMessage(
      sender,
      formatSubscriptionRemoved(subscription)
    )

    return {
      ok: true,
      intent: 'SUBSCRIPTION_DELETE',
      subscription,
      replySent: reply.success
    }
  } catch {
    const reply = await sendWhatsAppMessage(
      sender,
      `I couldn't remove that subscription. Please try again.`
    )

    return {
      ok: false,
      intent: 'SUBSCRIPTION_DELETE',
      replySent: reply.success
    }
  }
}

async function handleDeleteCancel(sender) {
  await clearState(sender)
  const reply = await sendWhatsAppMessage(sender, 'Cancelled. No changes made.')

  return {
    ok: true,
    cancelled: true,
    replySent: reply.success
  }
}

async function handleListMore(sender) {
  const state = await getState(sender)

  if (!state?.listType) {
    const reply = await sendWhatsAppMessage(
      sender,
      `Nothing else to show right now.

Try:
• show subscriptions
• show reminders`
    )

    return {
      ok: true,
      intent: 'LIST_MORE',
      replySent: reply.success
    }
  }

  const offset = state.offset || PAGE_SIZE
  const items = state.items || []
  const visible = items.slice(offset, offset + PAGE_SIZE)

  if (!visible.length) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(sender, 'No more items.')
    return { ok: true, intent: 'LIST_MORE', replySent: reply.success }
  }

  const body = visible.join('\n')
  const hasMore = items.length > offset + PAGE_SIZE
  const message = hasMore
    ? `${body}\n\nReply:\nmore`
    : body

  if (hasMore) {
    state.offset = offset + PAGE_SIZE
    const { setState } = require('../services/conversationStateService')
    await setState(sender, state)
  } else {
    await clearState(sender)
  }

  const title =
    state.listType === 'subscriptions'
      ? '📺 Subscriptions'
      : "🔎 Reminders"

  const reply = await sendWhatsAppMessage(sender, `${title}\n\n${message}`)

  return {
    ok: true,
    intent: 'LIST_MORE',
    replySent: reply.success
  }
}

async function buildReminderSummaries(sender, _state) {
  const now = new Date()
  const manualReminders = await getUserReminders(sender, {
    status: 'pending',
    limit: 50
  })
  const subscriptions = await getUserSubscriptions(sender)

  const manualSummaries = manualReminders.map((reminder) =>
    formatManualReminderSummary(reminder, now)
  )
  const subscriptionSummaries = subscriptions
    .map((subscription) => formatSubscriptionReminderSummary(subscription, now))
    .filter(Boolean)

  return [...manualSummaries, ...subscriptionSummaries]
}

module.exports = {
  PAGE_SIZE,
  handleDeleteConfirm,
  handleDeleteCancel,
  handleListMore,
  buildReminderSummaries,
  formatSubscription
}
