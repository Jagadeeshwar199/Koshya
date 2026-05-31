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
    `✅ Reminder created\n\n${formatReminder(reminder)}`
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
  handleReminderQueryIntent
}
