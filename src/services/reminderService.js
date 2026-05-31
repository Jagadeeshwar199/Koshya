const supabase = require('../../config/supabase')
const {
  formatSupabaseError,
  validateId
} = require('./subscriptionService')
const { ApiError } = require('../utils/apiError')

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

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function buildDate(year, monthIndex, day) {
  const safeDay = Math.min(day, daysInMonth(year, monthIndex))
  return new Date(year, monthIndex, safeDay)
}

function parseMonth(monthStr) {
  if (!monthStr) {
    return null
  }

  const key = String(monthStr).toLowerCase().slice(0, 3)
  return MONTH_INDEX[key] ?? null
}

function parseRecurrenceMonths(recurrence) {
  const match = String(recurrence || '')
    .toLowerCase()
    .trim()
    .match(/^(\d+)\s+months?$/)

  return match ? Number(match[1]) : null
}

function addMonths(date, months) {
  return buildDate(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function computeNextRenewalDate(subscription, fromDate = new Date()) {
  const day = Number(subscription.renewal_day)
  const recurrence = String(subscription.recurrence || '').toLowerCase().trim()
  const today = startOfDay(fromDate)

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null
  }

  if (recurrence === 'monthly') {
    let candidate = buildDate(today.getFullYear(), today.getMonth(), day)

    if (candidate < today) {
      candidate = buildDate(today.getFullYear(), today.getMonth() + 1, day)
    }

    return candidate
  }

  const monthIndex = parseMonth(subscription.renewal_month)

  if (recurrence === 'yearly' && monthIndex !== null) {
    let candidate = buildDate(today.getFullYear(), monthIndex, day)

    if (candidate < today) {
      candidate = buildDate(today.getFullYear() + 1, monthIndex, day)
    }

    return candidate
  }

  const recurrenceMonths = parseRecurrenceMonths(recurrence)

  if (recurrenceMonths && monthIndex !== null) {
    let candidate = buildDate(today.getFullYear(), monthIndex, day)

    while (candidate < today) {
      candidate = addMonths(candidate, recurrenceMonths)
    }

    return candidate
  }

  return null
}

function normalizeDaysAhead(daysAhead) {
  if (daysAhead === undefined || daysAhead === null) {
    return 1
  }

  const parsed = Number(daysAhead)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 30) {
    throw new ApiError(400, 'daysAhead must be an integer between 0 and 30')
  }

  return parsed
}

function buildReminderMessage(subscription, renewalDate) {
  const dateLabel = renewalDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  })

  return `${subscription.service_name} renews on ${dateLabel} for Rs ${subscription.amount}`
}

function mapReminderRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    userPhone: row.user_phone,
    message: row.message,
    status: row.status,
    triggerAt: row.trigger_at,
    sentAt: row.sent_at,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function reminderAlreadyQueued(reminder, dayStart, dayEnd) {
  const { data, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('user_phone', reminder.user_phone)
    .eq('message', reminder.message)
    .in('status', ['pending', 'processing', 'sent'])
    .gte('trigger_at', dayStart.toISOString())
    .lt('trigger_at', dayEnd.toISOString())
    .limit(1)

  if (error) {
    throw new ApiError(502, 'failed to check existing reminders', formatSupabaseError(error))
  }

  return Boolean(data?.length)
}

async function generateReminders(options = {}) {
  const daysAhead = normalizeDaysAhead(options.daysAhead)
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('active', true)

  if (error) {
    throw new ApiError(502, 'failed to fetch subscriptions', formatSupabaseError(error))
  }

  let generated = 0
  let skipped = 0

  for (const subscription of subscriptions || []) {
    const renewalDate = computeNextRenewalDate(subscription, now)

    if (!renewalDate) {
      skipped++
      continue
    }

    const reminderDaysBefore = Number(subscription.reminder_days_before ?? 1)
    const windowDays = Math.max(daysAhead, reminderDaysBefore)
    const windowEnd = startOfDay(addDays(today, windowDays))

    if (renewalDate < today || renewalDate > windowEnd) {
      skipped++
      continue
    }

    const reminder = {
      user_phone: subscription.user_phone,
      message: buildReminderMessage(subscription, renewalDate),
      status: 'pending',
      trigger_at: now.toISOString(),
      retry_count: 0
    }

    if (await reminderAlreadyQueued(reminder, today, tomorrow)) {
      skipped++
      continue
    }

    const { error: insertError } = await supabase
      .from('reminders')
      .insert(reminder)

    if (insertError) {
      throw new ApiError(502, 'failed to create reminder', formatSupabaseError(insertError))
    }

    generated++
  }

  return {
    generated,
    skipped
  }
}

async function getPendingReminders() {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('status', 'pending')
    .order('trigger_at', { ascending: true })

  if (error) {
    throw new ApiError(502, 'failed to fetch pending reminders', formatSupabaseError(error))
  }

  return (data || []).map(mapReminderRow)
}

async function markReminderSent(id) {
  const reminderId = validateId(id)

  const { data, error } = await supabase
    .from('reminders')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', reminderId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to mark reminder sent', formatSupabaseError(error))
  }

  if (!data) {
    throw new ApiError(404, 'reminder not found')
  }

  return mapReminderRow(data)
}

module.exports = {
  generateReminders,
  getPendingReminders,
  markReminderSent,
  computeNextRenewalDate,
  mapReminderRow
}
