const supabase = require('../config/supabase')
const { sendWhatsAppMessage } = require('./whatsappService')

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseMonth(monthStr) {
  if (!monthStr) {
    return null
  }

  const key = String(monthStr).toLowerCase().slice(0, 3)
  return MONTH_INDEX[key] ?? null
}

function computeNextRenewalDate(sub, fromDate = new Date()) {
  const day = sub.renewal_day
  const monthIdx = parseMonth(sub.renewal_month)
  const today = startOfDay(fromDate)

  if (sub.recurrence === 'monthly' && day) {
    let candidate = new Date(today.getFullYear(), today.getMonth(), day)

    if (candidate < today) {
      candidate = new Date(today.getFullYear(), today.getMonth() + 1, day)
    }

    return candidate
  }

  if (sub.recurrence === 'yearly' && day && monthIdx !== null) {
    let candidate = new Date(today.getFullYear(), monthIdx, day)

    if (candidate < today) {
      candidate = new Date(today.getFullYear() + 1, monthIdx, day)
    }

    return candidate
  }

  return null
}

function isSubscriptionReminderDue(sub, fromDate = new Date()) {
  const nextRenewal = computeNextRenewalDate(sub, fromDate)

  if (!nextRenewal) {
    return false
  }

  const daysBefore = sub.reminder_days_before ?? 1
  const reminderStart = startOfDay(addDays(nextRenewal, -daysBefore))
  const renewalDay = startOfDay(nextRenewal)
  const today = startOfDay(fromDate)

  if (today < reminderStart || today > renewalDay) {
    return false
  }

  if (sub.last_reminded_at) {
    const lastReminded = startOfDay(new Date(sub.last_reminded_at))

    if (lastReminded >= reminderStart) {
      return false
    }
  }

  return true
}

async function processQueuedReminders() {
  const now = new Date().toISOString()
  let sent = 0

  while (true) {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('trigger_at', now)
      .lt('retry_count', 3)
      .order('trigger_at', { ascending: true })
      .limit(50)

    if (error) {
      console.log('Reminder fetch error:', error)
      break
    }

    if (!data?.length) {
      break
    }

    for (const reminder of data) {
      try {
        await supabase
          .from('reminders')
          .update({ status: 'processing' })
          .eq('id', reminder.id)

        await sendWhatsAppMessage(
          reminder.user_phone,
          `⏰ Reminder: ${reminder.message}`
        )

        await supabase
          .from('reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id)

        sent++
      } catch (err) {
        console.log('Reminder failed:', reminder.id, err)

        await supabase
          .from('reminders')
          .update({
            status: 'failed',
            retry_count: (reminder.retry_count || 0) + 1
          })
          .eq('id', reminder.id)
      }
    }

    if (data.length < 50) {
      break
    }
  }

  return sent
}

async function processSubscriptionReminders() {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('active', true)

  if (error) {
    console.log('Subscription fetch error:', error)
    return 0
  }

  let sent = 0
  const now = new Date()

  for (const sub of subscriptions || []) {
    if (!isSubscriptionReminderDue(sub, now)) {
      continue
    }

    try {
      const renewalDate = computeNextRenewalDate(sub, now)
      const dateLabel = renewalDate
        ? renewalDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
          })
        : ''

      await sendWhatsAppMessage(
        sub.user_phone,
        `⚠️ Subscription Reminder

📦 ${sub.service_name}
💰 ₹${sub.amount}
📅 Renews on ${dateLabel}

Reply with updates anytime.`
      )

      await supabase
        .from('subscriptions')
        .update({
          last_reminded_at: now.toISOString()
        })
        .eq('id', sub.id)

      sent++
      console.log(`Reminder sent for ${sub.service_name}`)
    } catch (err) {
      console.log(`Subscription reminder failed: ${sub.id}`, err)
    }
  }

  return sent
}

async function runReminderJob() {
  console.log('⏰ Reminder job started at', new Date().toISOString())

  const queued = await processQueuedReminders()
  const subscriptions = await processSubscriptionReminders()

  console.log(
    `✅ Reminder job done — queued: ${queued}, subscriptions: ${subscriptions}`
  )

  return { queued, subscriptions }
}

module.exports = {
  runReminderJob,
  isSubscriptionReminderDue,
  computeNextRenewalDate
}
