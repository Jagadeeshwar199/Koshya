const {
  generateReminders,
  createReminderFromIntent,
  getPendingReminders,
  getUserReminders,
  markReminderSent
} = require('../services/reminderService')
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
    return `Today at ${time}`
  }

  if (triggerKey === tomorrowKey) {
    return `Tomorrow at ${time}`
  }

  return `${parts.day} ${parts.month} ${parts.year} at ${time}`
}

function formatReminderConfirmation(reminder, now = new Date()) {
  return `✅ Reminder created

${reminder.message}
${formatReminderTime(reminder.triggerAt, now)}

This reminder will be sent once.`
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
  const reminders = await getUserReminders(sender, {
    serviceName: intent.entities.serviceName,
    limit: 5
  })

  const body = reminders.length
    ? reminders.map(formatReminder).join('\n')
    : 'No reminders found.'

  const reply = await sendWhatsAppMessage(sender, `🔎 Reminders\n\n${body}`)

  return {
    ok: true,
    intent: intent.intent,
    reminders,
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
  formatReminderConfirmation
}
