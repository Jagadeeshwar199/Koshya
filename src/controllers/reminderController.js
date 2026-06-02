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
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { setState, clearState } = require('../services/conversationStateService')
const { PAGE_SIZE } = require('./paginationController')
const { REM_SAVED_NEXT } = require('../utils/uxMessages')
const {
  formatReminderConfirmation,
  formatReminderUpdateConfirmation,
  formatReminderCancelConfirmation,
  formatManualReminderSummary,
  formatReminderOption,
  reminderMatchesDate
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
      draftMessage: text,
      draftEntities: intent.entities
    })
    const reply = await sendWhatsAppMessage(
      sender,
      `When should I remind you?\n\nTry:\ntomorrow at 8 PM`
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
    `${formatReminderConfirmation(reminder)}${REM_SAVED_NEXT}`
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
      `What time should I use?\n\nTry:\nChange reminder to 7 PM`
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

async function handleReminderCreateTimeFollowUp(sender, draftMessage, timeText, priorEntities = null) {
  const draftIntent = detectIntent(draftMessage)
  const timeIntent = detectIntent(timeText)
  const entities = {
    ...draftIntent.entities,
    ...(priorEntities || {}),
    date: mergeDateEntities(
      mergeDateEntities(draftIntent.entities.date, priorEntities?.date),
      timeIntent.entities.date
    )
  }

  if (needsExplicitTimePrompt({ date: entities.date })) {
    await setState(sender, {
      action: 'awaiting_reminder_create_time',
      draftMessage,
      draftEntities: { date: entities.date }
    })
    const reply = await sendWhatsAppMessage(
      sender,
      `When should I remind you?\n\nTry:\ntomorrow at 8 PM`
    )
    return { ok: true, intent: 'REMINDER_CREATE', reminder: null, replySent: reply.success }
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
  const manualReminders = await getUserReminders(sender, {
    status: 'pending',
    limit: 50,
    manualOnly: true
  })
  const filteredManualReminders = dedupeReminders(
    manualReminders.filter((reminder) =>
      reminderMatchesDate(reminder, intent.entities.date, now)
    )
  )

  const title = intent.entities.date?.value === 'tomorrow'
    ? `🔎 Tomorrow's reminders`
    : intent.entities.date?.value === 'today'
      ? `🔎 Today's reminders`
      : '🔎 Reminders'

  const visibleSummaries = filteredManualReminders
    .slice(0, PAGE_SIZE)
    .map((reminder) => formatManualReminderSummary(reminder, now))
  const body = visibleSummaries.length
    ? `${visibleSummaries.join('\n')}${filteredManualReminders.length > PAGE_SIZE ? '\n\nReply:\nmore' : ''}`
    : intent.entities.date?.value === 'tomorrow'
      ? 'No reminders tomorrow 🎉'
      : intent.entities.date?.value === 'today'
        ? 'No reminders today 🎉'
        : 'No reminders.'

  if (filteredManualReminders.length > PAGE_SIZE) {
    await setState(sender, {
      listType: 'reminders',
      items: filteredManualReminders.map((reminder) =>
        formatManualReminderSummary(reminder, now)
      ),
      offset: PAGE_SIZE
    })
  }

  const reply = await sendWhatsAppMessage(sender, `${title}\n\n${body}`)

  return {
    ok: true,
    intent: intent.intent,
    reminders: filteredManualReminders,
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
  formatReminderCancelConfirmation
}
