const {
  detectIntent,
  mergeDateEntities,
  needsExplicitTimePrompt
} = require('../services/intentService')
const {
  generateReminders,
  createReminderFromIntent,
  updateLatestReminderFromIntent,
  cancelReminderFromIntent,
  getPendingReminders,
  getUserReminders,
  markReminderSent,
  resolveTriggerAt,
  dedupeReminders
} = require('../services/reminderService')
const { getUserSubscriptions } = require('../services/subscriptionService')
const { matchSubscriptionsByService } = require('../utils/serviceMatcher')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { setState, clearState } = require('../services/conversationStateService')
const { PAGE_SIZE } = require('./paginationController')
const {
  formatReminderConfirmation,
  formatReminderUpdateConfirmation,
  formatReminderCancelConfirmation,
  formatManualReminderSummary,
  formatReminderOption,
  formatSubscriptionReminderDetail,
  formatSubscriptionReminderSummary,
  reminderMatchesDate,
  getIstDateKey,
  subscriptionToReminderDate
} = require('../formatters/reminderFormatter')

async function generate(req, res, next) {
  try {
    const result = await generateReminders(req.body || {})
    res.status(201).json({
      success: true,
      ...result
    })
  } catch (err) {
    next(err)
  }
}

async function pending(req, res, next) {
  try {
    const reminders = await getPendingReminders()
    res.json({
      success: true,
      reminders
    })
  } catch (err) {
    next(err)
  }
}

async function sent(req, res, next) {
  try {
    const reminder = await markReminderSent(req.params.id)
    res.json({
      success: true,
      reminder
    })
  } catch (err) {
    next(err)
  }
}

async function handleReminderCreateIntent(sender, text, intent) {
  if (needsExplicitTimePrompt(intent.entities)) {
    await setState(sender, {
      action: 'awaiting_reminder_create_time',
      draftMessage: text
    })
    const reply = await sendWhatsAppMessage(
      sender,
      `What time should I remind you?\n\nTry:\n7 PM`
    )
    return {
      ok: true,
      intent: intent.intent,
      reminder: null,
      replySent: reply.success
    }
  }

  const reminder = await createReminderFromIntent({
    userPhone: sender,
    message: text,
    entities: intent.entities
  })

  const reply = await sendWhatsAppMessage(
    sender,
    formatReminderConfirmation(reminder)
  )

  return {
    ok: true,
    intent: intent.intent,
    reminder,
    replySent: reply.success
  }
}

async function handleReminderUpdateIntent(sender, intent) {
  if (!intent.entities.date) {
    await setState(sender, { action: 'awaiting_reminder_time' })
    const reply = await sendWhatsAppMessage(
      sender,
      `What time should I use?\n\nTry:\nchange to 7 PM`
    )

    return {
      ok: true,
      intent: intent.intent,
      reminder: null,
      replySent: reply.success
    }
  }

  const reminder = await updateLatestReminderFromIntent({
    userPhone: sender,
    entities: intent.entities
  })

  if (!reminder) {
    const reply = await sendWhatsAppMessage(
      sender,
      `I couldn't find an active reminder to update.`
    )

    return {
      ok: true,
      intent: intent.intent,
      reminder: null,
      replySent: reply.success
    }
  }

  await clearState(sender)
  const reply = await sendWhatsAppMessage(
    sender,
    formatReminderUpdateConfirmation(reminder)
  )

  return {
    ok: true,
    intent: intent.intent,
    reminder,
    replySent: reply.success
  }
}

async function handleReminderTimeFollowUp(sender, dateEntity) {
  const reminder = await updateLatestReminderFromIntent({
    userPhone: sender,
    entities: { date: dateEntity }
  })

  if (!reminder) {
    await clearState(sender)
    const reply = await sendWhatsAppMessage(
      sender,
      `I couldn't find an active reminder to update.`
    )
    return { ok: true, intent: 'REMINDER_RESCHEDULE', reminder: null, replySent: reply.success }
  }

  await clearState(sender)
  const reply = await sendWhatsAppMessage(
    sender,
    formatReminderUpdateConfirmation(reminder)
  )
  return { ok: true, intent: 'REMINDER_RESCHEDULE', reminder, replySent: reply.success }
}

async function handleReminderCreateTimeFollowUp(sender, draftMessage, timeText) {
  const draftIntent = detectIntent(draftMessage)
  const timeIntent = detectIntent(timeText)
  const entities = {
    ...draftIntent.entities,
    date: mergeDateEntities(draftIntent.entities.date, timeIntent.entities.date)
  }

  await clearState(sender)
  return handleReminderCreateIntent(sender, draftMessage, {
    ...draftIntent,
    entities
  })
}

async function handleReminderCancelIntent(sender, intent) {
  const result = await cancelReminderFromIntent({
    userPhone: sender,
    entities: intent.entities
  })

  if (result.status === 'not_found') {
    const reply = await sendWhatsAppMessage(
      sender,
      `I couldn't find an active reminder to cancel.`
    )

    return {
      ok: true,
      intent: intent.intent,
      reminders: [],
      replySent: reply.success
    }
  }

  if (result.status === 'multiple') {
    const options = result.reminders
      .map((reminder, index) => formatReminderOption(reminder, index))
      .join('\n')
    const reply = await sendWhatsAppMessage(
      sender,
      `Which reminder should I cancel?\n\n${options}\n\nReply with the reminder name.`
    )

    return {
      ok: true,
      intent: intent.intent,
      reminders: result.reminders,
      replySent: reply.success
    }
  }

  const reply = await sendWhatsAppMessage(
    sender,
    formatReminderCancelConfirmation(result.reminder)
  )

  return {
    ok: true,
    intent: intent.intent,
    reminder: result.reminder,
    replySent: reply.success
  }
}

async function handleReminderQueryIntent(sender, intent) {
  const now = new Date()
  const serviceName = intent.entities.serviceName
  const manualReminders = await getUserReminders(sender, {
    serviceName: intent.entities.serviceName,
    status: 'pending',
    limit: 50
  })
  const filteredManualReminders = dedupeReminders(
    manualReminders.filter((reminder) =>
      reminderMatchesDate(reminder, intent.entities.date, now)
    )
  )
  const subscriptions = await getUserSubscriptions(sender)
  const filteredSubscriptions = matchSubscriptionsByService(subscriptions, serviceName)

  if (serviceName && filteredSubscriptions.length) {
    const reply = await sendWhatsAppMessage(
      sender,
      formatSubscriptionReminderDetail(filteredSubscriptions[0])
    )

    return {
      ok: true,
      intent: intent.intent,
      reminders: filteredManualReminders,
      subscriptions: filteredSubscriptions,
      replySent: reply.success
    }
  }

  const subscriptionSummaries = filteredSubscriptions
    .map((subscription) => formatSubscriptionReminderSummary(subscription, now))
    .filter(Boolean)
    .filter((line) => {
      if (!intent.entities.date) {
        return true
      }

      const reminderDate = subscriptionToReminderDate(
        filteredSubscriptions.find((subscription) =>
          line.includes(subscription.serviceName)
        )
      )
      return getIstDateKey(reminderDate) === getIstDateKey(resolveTriggerAt(intent.entities.date, now))
    })
  const manualSummaries = filteredManualReminders.map((reminder) =>
    formatManualReminderSummary(reminder, now)
  )
  const summaries = [...manualSummaries, ...subscriptionSummaries]
  const title = intent.entities.date?.value === 'tomorrow'
    ? `🔎 Tomorrow's reminders`
    : '🔎 Active reminders'

  const visibleSummaries = summaries.slice(0, PAGE_SIZE)
  const body = visibleSummaries.length
    ? `${visibleSummaries.join('\n')}${summaries.length > PAGE_SIZE ? '\n\nReply:\nmore' : ''}`
    : intent.entities.date?.value === 'tomorrow'
      ? 'No reminders tomorrow 🎉'
      : 'No reminders.'

  if (summaries.length > PAGE_SIZE) {
    await setState(sender, {
      listType: 'reminders',
      items: summaries,
      offset: PAGE_SIZE
    })
  }

  const reply = await sendWhatsAppMessage(sender, `${title}\n\n${body}`)

  return {
    ok: true,
    intent: intent.intent,
    reminders: filteredManualReminders,
    subscriptions: filteredSubscriptions,
    replySent: reply.success
  }
}

module.exports = {
  generate,
  pending,
  sent,
  handleReminderCreateIntent,
  handleReminderCancelIntent,
  handleReminderUpdateIntent,
  handleReminderTimeFollowUp,
  handleReminderCreateTimeFollowUp,
  handleReminderQueryIntent,
  formatReminderConfirmation,
  formatReminderUpdateConfirmation,
  formatReminderCancelConfirmation,
  matchSubscriptionsByService
}
