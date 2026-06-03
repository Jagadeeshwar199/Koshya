const {
  getActiveReminders,
  cancelReminder,
  normalizeReminderMessage,
  unpackReminderMessage
} = require('./reminderService')
const {
  getUserSubscriptions,
  archiveSubscription
} = require('./subscriptionService')
const {
  matchSubscriptionsByService,
  normalizeServiceName
} = require('../utils/serviceMatcher')

function extractDeleteEntity(text) {
  const match = String(text || '').match(
    /^(?:delete|cancel|remove)\s+(?:my\s+)?(.+?)\s*$/i
  )
  return match?.[1]?.trim() || null
}

function rankReminder(reminder, entityNorm) {
  const { title } = unpackReminderMessage(reminder.message)
  const titleNorm = normalizeReminderMessage(title)
  if (titleNorm === entityNorm) {
    return 'exact'
  }
  if (titleNorm.includes(entityNorm) || entityNorm.includes(titleNorm)) {
    return 'fuzzy'
  }
  return null
}

function rankSubscriptions(subscriptions, entityName) {
  const entityNorm = normalizeServiceName(entityName)
  const exact = subscriptions.filter(
    (s) => normalizeServiceName(s.serviceName) === entityNorm
  )
  if (exact.length) {
    return exact.map((item) => ({ type: 'subscription', item, match: 'exact' }))
  }
  const fuzzy = matchSubscriptionsByService(subscriptions, entityName)
  return fuzzy.map((item) => ({ type: 'subscription', item, match: 'fuzzy' }))
}

function pickSingle(candidates) {
  const exact = candidates.filter((c) => c.match === 'exact')
  if (exact.length === 1) {
    return { status: 'single', ...exact[0] }
  }
  if (exact.length > 1) {
    return { status: 'multiple', candidates: exact }
  }
  const fuzzy = candidates.filter((c) => c.match === 'fuzzy')
  if (fuzzy.length === 1) {
    return { status: 'single', ...fuzzy[0] }
  }
  if (fuzzy.length > 1) {
    return { status: 'multiple', candidates: fuzzy }
  }
  return null
}

async function resolveUnifiedDelete({ userPhone, entityName }) {
  if (!entityName) {
    return { status: 'needs_name' }
  }

  const entityNorm = normalizeReminderMessage(entityName)
  const reminders = await getActiveReminders(userPhone)
  const subscriptions = await getUserSubscriptions(userPhone)

  const reminderCandidates = reminders
    .map((reminder) => {
      const match = rankReminder(reminder, entityNorm)
      return match ? { type: 'reminder', item: reminder, match } : null
    })
    .filter(Boolean)

  const subscriptionCandidates = rankSubscriptions(subscriptions, entityName)

  const reminderPick = pickSingle(reminderCandidates)
  const subscriptionPick = pickSingle(subscriptionCandidates)

  if (reminderPick?.status === 'single' && !subscriptionPick) {
    return reminderPick
  }
  if (subscriptionPick?.status === 'single' && !reminderPick) {
    return subscriptionPick
  }
  if (reminderPick?.status === 'single' && subscriptionPick?.status === 'single') {
    return {
      status: 'multiple',
      candidates: [reminderPick, subscriptionPick]
    }
  }

  const combined = [
    ...(reminderPick?.candidates || (reminderPick ? [reminderPick] : [])),
    ...(subscriptionPick?.candidates || (subscriptionPick ? [subscriptionPick] : []))
  ]

  if (combined.length === 1) {
    return combined[0]
  }
  if (combined.length > 1) {
    return { status: 'multiple', candidates: combined }
  }

  return { status: 'not_found' }
}

async function executeUnifiedDelete(resolved) {
  if (resolved.type === 'reminder') {
    const reminder = await cancelReminder(resolved.item.id)
    return { type: 'reminder', reminder }
  }
  const subscription = await archiveSubscription(resolved.item.id)
  return { type: 'subscription', subscription }
}

module.exports = {
  extractDeleteEntity,
  resolveUnifiedDelete,
  executeUnifiedDelete
}
