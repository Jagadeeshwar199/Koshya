const {
  generateReminders,
  createReminderFromIntent,
  getPendingReminders,
  getUserReminders,
  markReminderSent,
  computeNextRenewalDate,
  resolveTriggerAt
} = require('../services/reminderService')
const { getUserSubscriptions } = require('../services/subscriptionService')
const { sendWhatsAppMessage } = require('../../services/whatsappService')

function formatReminder(reminder) {
  return `• ${reminder.message} (${reminder.status}, ${reminder.triggerAt || 'no date'})`
}

function getIstParts(date) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  )
}

function getIstDateKey(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  return formatter.format(date)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatReminderTime(triggerAt, now = new Date()) {
  if (!triggerAt) {
    return 'No delivery time set'
  }

  const triggerDate = new Date(triggerAt)
  const parts = getIstParts(triggerDate)
  const time = `${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()} IST`
  const triggerKey = getIstDateKey(triggerDate)
  const todayKey = getIstDateKey(now)
  const tomorrowKey = getIstDateKey(addDays(now, 1))

  if (triggerKey === todayKey) {
    return { dateLabel: 'Today', timeLabel: time }
  }

  if (triggerKey === tomorrowKey) {
    return { dateLabel: 'Tomorrow', timeLabel: time }
  }

  return {
    dateLabel: `${parts.day} ${parts.month} ${parts.year}`,
    timeLabel: time
  }
}

function formatReminderListTime(triggerAt, now = new Date()) {
  const formatted = formatReminderTime(triggerAt, now)
  return `${formatted.dateLabel} ${formatted.timeLabel.replace(' IST', '')}`
}

function formatReminderConfirmation(reminder, now = new Date()) {
  const formatted = formatReminderTime(reminder.triggerAt, now)

  return `✅ Reminder created

${reminder.message}
📅 ${formatted.dateLabel}
⏰ ${formatted.timeLabel}

This reminder will be sent once.

Reply:
"change to 7 AM"
or
"change to 6 PM"

to update the reminder.`
}

function reminderMatchesDate(reminder, dateEntity, now = new Date()) {
  if (!dateEntity || !reminder.triggerAt) {
    return true
  }

  const target = resolveTriggerAt(dateEntity, now)
  return getIstDateKey(new Date(reminder.triggerAt)) === getIstDateKey(target)
}

function formatManualReminderSummary(reminder, now = new Date()) {
  return `• ${reminder.message} — ${formatReminderListTime(reminder.triggerAt, now)}`
}

function recurrenceLabel(recurrence) {
  if (recurrence === 'monthly') {
    return 'month'
  }

  if (recurrence === 'yearly') {
    return 'year'
  }

  return recurrence
}

function subscriptionToReminderDate(subscription) {
  const renewalDate = computeNextRenewalDate({
    renewal_day: subscription.renewalDay,
    renewal_month: subscription.renewalMonth,
    recurrence: subscription.recurrence
  })

  if (!renewalDate) {
    return null
  }

  const reminderDate = addDays(
    renewalDate,
    -(subscription.reminderDaysBefore || 1)
  )
  reminderDate.setUTCHours(4, 30, 0, 0)

  return reminderDate
}

function formatSubscriptionReminderDetail(subscription, now = new Date()) {
  const reminderDate = subscriptionToReminderDate(subscription)
  const reminderTime = reminderDate
    ? formatReminderListTime(reminderDate, now)
    : 'Not scheduled'

  return `📺 ${subscription.serviceName}

💰 ₹${subscription.amount}/${recurrenceLabel(subscription.recurrence)}
📅 Renewal day: ${subscription.renewalDay}
🔔 Reminder: ${subscription.reminderDaysBefore || 1} day before renewal
⏰ Next reminder: ${reminderTime} IST
✅ Status: ${subscription.active ? 'Active' : 'Inactive'}`
}

function formatSubscriptionReminderSummary(subscription, now = new Date()) {
  const reminderDate = subscriptionToReminderDate(subscription)

  if (!reminderDate) {
    return null
  }

  return `• ${subscription.serviceName} renewal — ${formatReminderListTime(reminderDate, now)}`
}

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

async function handleReminderQueryIntent(sender, intent) {
  const now = new Date()
  const serviceName = intent.entities.serviceName?.toLowerCase()
  const manualReminders = await getUserReminders(sender, {
    serviceName: intent.entities.serviceName,
    status: 'pending',
    limit: 50
  })
  const filteredManualReminders = manualReminders.filter((reminder) =>
    reminderMatchesDate(reminder, intent.entities.date, now)
  )
  const subscriptions = await getUserSubscriptions(sender)
  const filteredSubscriptions = serviceName
    ? subscriptions.filter((subscription) =>
        subscription.serviceName.toLowerCase().includes(serviceName)
      )
    : subscriptions

  if (serviceName && filteredSubscriptions.length) {
    const reply = await sendWhatsAppMessage(
      sender,
      formatSubscriptionReminderDetail(filteredSubscriptions[0], now)
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

  const body = summaries.length
    ? summaries.join('\n')
    : 'No reminders found.'

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
  handleReminderQueryIntent,
  formatReminderTime,
  formatReminderConfirmation,
  formatReminderListTime
}
