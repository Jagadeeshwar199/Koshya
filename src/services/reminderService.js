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
const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}
const IST_OFFSET_MINUTES = 330
const DEFAULT_REMINDER_TIMES = {
  default: { hour: 10, minute: 0 },
  morning: { hour: 10, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 18, minute: 0 }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonthsToParts(parts, months) {
  const monthIndex = parts.month + months
  const year = parts.year + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const day = Math.min(parts.day, daysInMonth(year, month))

  return {
    ...parts,
    year,
    month,
    day
  }
}

function getIstPartsFromDate(date) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000)

  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    day: istDate.getUTCDate(),
    hour: istDate.getUTCHours(),
    minute: istDate.getUTCMinutes(),
    weekday: istDate.getUTCDay()
  }
}

function dateFromIstParts(parts) {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0
    ) -
      IST_OFFSET_MINUTES * 60 * 1000
  )
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

function getReminderTime(dateEntity = {}) {
  if (dateEntity.time) {
    return {
      hour: dateEntity.time.hour,
      minute: dateEntity.time.minute || 0
    }
  }

  return DEFAULT_REMINDER_TIMES[dateEntity.period] || DEFAULT_REMINDER_TIMES.default
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

function withinCatchUpWindow(renewalDate, today, catchUpDays) {
  return renewalDate < today && today <= startOfDay(addDays(renewalDate, catchUpDays))
}

function computeReminderRenewalDate(subscription, fromDate, catchUpDays) {
  const day = Number(subscription.renewal_day)
  const recurrence = String(subscription.recurrence || '').toLowerCase().trim()
  const today = startOfDay(fromDate)

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null
  }

  if (recurrence === 'monthly') {
    const current = buildDate(today.getFullYear(), today.getMonth(), day)

    if (withinCatchUpWindow(current, today, catchUpDays)) {
      return current
    }

    return computeNextRenewalDate(subscription, fromDate)
  }

  const monthIndex = parseMonth(subscription.renewal_month)

  if (recurrence === 'yearly' && monthIndex !== null) {
    const current = buildDate(today.getFullYear(), monthIndex, day)

    if (withinCatchUpWindow(current, today, catchUpDays)) {
      return current
    }

    return computeNextRenewalDate(subscription, fromDate)
  }

  const recurrenceMonths = parseRecurrenceMonths(recurrence)

  if (recurrenceMonths && monthIndex !== null) {
    let previous = null
    let candidate = buildDate(today.getFullYear(), monthIndex, day)

    while (candidate < today) {
      previous = candidate
      candidate = addMonths(candidate, recurrenceMonths)
    }

    if (previous && withinCatchUpWindow(previous, today, catchUpDays)) {
      return previous
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

function normalizeCatchUpDays(catchUpDays) {
  if (catchUpDays === undefined || catchUpDays === null) {
    return Number(process.env.REMINDER_CATCH_UP_DAYS || 7)
  }

  const parsed = Number(catchUpDays)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 30) {
    throw new ApiError(400, 'catchUpDays must be an integer between 0 and 30')
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

function resolveTriggerAt(dateEntity, now = new Date()) {
  const nowParts = getIstPartsFromDate(now)
  const reminderTime = getReminderTime(dateEntity)
  let targetParts = {
    ...nowParts,
    hour: reminderTime.hour,
    minute: reminderTime.minute
  }

  if (!dateEntity) {
    const todayDefault = dateFromIstParts(targetParts)
    return todayDefault > now
      ? todayDefault
      : dateFromIstParts({ ...targetParts, day: targetParts.day + 1 })
  }

  if (dateEntity.kind === 'relative_duration') {
    const multiplier = dateEntity.unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000
    return new Date(now.getTime() + Number(dateEntity.value) * multiplier)
  }

  if (dateEntity.kind === 'relative' && dateEntity.value === 'tomorrow') {
    return dateFromIstParts({ ...targetParts, day: targetParts.day + 1 })
  }

  if (dateEntity.kind === 'relative' && dateEntity.value === 'today') {
    const today = dateFromIstParts(targetParts)
    return today > now
      ? today
      : dateFromIstParts({ ...targetParts, day: targetParts.day + 1 })
  }

  if (dateEntity.kind === 'time_only') {
    return dateFromIstParts(targetParts)
  }

  if (dateEntity.kind === 'relative' && dateEntity.value === 'next_week') {
    return dateFromIstParts({ ...targetParts, day: targetParts.day + 7 })
  }

  if (dateEntity.kind === 'relative' && dateEntity.value === 'next_month') {
    return dateFromIstParts(addMonthsToParts(targetParts, 1))
  }

  if (dateEntity.kind === 'weekday') {
    const weekdayIndex = WEEKDAY_INDEX[dateEntity.value]

    if (weekdayIndex === undefined) {
      return dateFromIstParts(targetParts)
    }

    let daysUntil = (weekdayIndex - nowParts.weekday + 7) % 7

    if (daysUntil === 0) {
      daysUntil = 7
    }

    return dateFromIstParts({ ...targetParts, day: targetParts.day + daysUntil })
  }

  if (dateEntity.kind === 'month_day') {
    const monthIndex = parseMonth(dateEntity.month)

    if (monthIndex === null) {
      return dateFromIstParts(targetParts)
    }

    let candidate = dateFromIstParts({
      ...targetParts,
      month: monthIndex,
      day: dateEntity.day
    })

    if (candidate < now) {
      candidate = dateFromIstParts({
        ...targetParts,
        year: targetParts.year + 1,
        month: monthIndex,
        day: dateEntity.day
      })
    }

    return candidate
  }

  if (dateEntity.kind === 'day') {
    let candidate = dateFromIstParts({
      ...targetParts,
      day: dateEntity.day
    })

    if (candidate < now) {
      const nextMonth = addMonthsToParts(targetParts, 1)
      candidate = dateFromIstParts({
        ...nextMonth,
        day: dateEntity.day
      })
    }

    return candidate
  }

  return dateFromIstParts(targetParts)
}

function cleanReminderSubject(message, serviceName) {
  if (serviceName) {
    return serviceName
  }

  return String(message || '')
    .replace(/\b(?:remind me|create a reminder|set a reminder|add a reminder|tomorrow|today|about|for|to|at|morning|afternoon|evening|next|week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Reminder'
}

function normalizeReminderMessage(message) {
  return String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function createReminderFromIntent({ userPhone, message, entities = {} }) {
  if (!userPhone) {
    throw new ApiError(400, 'userPhone is required')
  }

  const subject = cleanReminderSubject(message, entities.serviceName)
  const triggerAt = resolveTriggerAt(entities.date)

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_phone: userPhone,
      message: subject,
      status: 'pending',
      trigger_at: triggerAt.toISOString(),
      retry_count: 0
    })
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to create reminder', formatSupabaseError(error))
  }

  return mapReminderRow(data)
}

async function getLatestActiveReminder(userPhone) {
  if (!userPhone) {
    throw new ApiError(400, 'userPhone is required')
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_phone', userPhone)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to fetch latest reminder', formatSupabaseError(error))
  }

  return mapReminderRow(data)
}

async function updateLatestReminderFromIntent({ userPhone, entities = {} }) {
  const reminder = await getLatestActiveReminder(userPhone)

  if (!reminder) {
    return null
  }

  const existingTriggerAt = reminder.triggerAt
    ? new Date(reminder.triggerAt)
    : new Date()
  const triggerAt = resolveTriggerAt(entities.date, existingTriggerAt)

  const { data, error } = await supabase
    .from('reminders')
    .update({
      trigger_at: triggerAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', reminder.id)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to update reminder', formatSupabaseError(error))
  }

  return mapReminderRow(data)
}

async function getActiveReminders(userPhone, options = {}) {
  if (!userPhone) {
    throw new ApiError(400, 'userPhone is required')
  }

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('user_phone', userPhone)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(options.limit || 20)

  const { data, error } = await query

  if (error) {
    throw new ApiError(502, 'failed to fetch active reminders', formatSupabaseError(error))
  }

  return (data || []).map(mapReminderRow)
}

function matchRemindersBySubject(reminders, subject) {
  if (!subject) {
    return reminders
  }

  const normalizedSubject = normalizeReminderMessage(subject)

  return reminders.filter((reminder) =>
    normalizeReminderMessage(reminder.message).includes(normalizedSubject)
  )
}

async function cancelReminder(id) {
  const { data, error } = await supabase
    .from('reminders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to cancel reminder', formatSupabaseError(error))
  }

  return mapReminderRow(data)
}

async function cancelReminderFromIntent({ userPhone, entities = {} }) {
  const reminders = await getActiveReminders(userPhone)
  const matches = matchRemindersBySubject(reminders, entities.serviceName)

  if (!matches.length) {
    return { status: 'not_found', reminders: [] }
  }

  if (matches.length > 1) {
    return { status: 'multiple', reminders: matches }
  }

  const reminder = await cancelReminder(matches[0].id)
  return { status: 'cancelled', reminder }
}

async function getUserReminders(userPhone, options = {}) {
  if (!userPhone) {
    throw new ApiError(400, 'userPhone is required')
  }

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('user_phone', userPhone)
    .order('trigger_at', { ascending: true })
    .limit(options.limit || 10)

  if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.serviceName) {
    query = query.ilike('message', `%${options.serviceName}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError(502, 'failed to fetch reminders', formatSupabaseError(error))
  }

  return (data || []).map(mapReminderRow)
}

async function reminderAlreadyQueued(reminder, dayStart, dayEnd) {
  let query = supabase
    .from('reminders')
    .select('id')
    .eq('message', reminder.message)
    .in('status', ['pending', 'processing', 'sent', 'failed'])
    .gte('trigger_at', dayStart.toISOString())
    .lt('trigger_at', dayEnd.toISOString())
    .limit(1)

  if (reminder.subscription_id) {
    query = query.eq('subscription_id', reminder.subscription_id)
  } else {
    query = query.eq('user_phone', reminder.user_phone)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError(502, 'failed to check existing reminders', formatSupabaseError(error))
  }

  return Boolean(data?.length)
}

async function generateReminders(options = {}) {
  const daysAhead = normalizeDaysAhead(options.daysAhead)
  const catchUpDays = normalizeCatchUpDays(options.catchUpDays)
  const now = options.now ? new Date(options.now) : new Date()
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
    const renewalDate = computeReminderRenewalDate(subscription, now, catchUpDays)

    if (!renewalDate) {
      skipped++
      continue
    }

    const reminderDaysBefore = Number(subscription.reminder_days_before ?? 1)
    const windowDays = Math.max(daysAhead, reminderDaysBefore)
    const windowEnd = startOfDay(addDays(today, windowDays))
    const catchUpEnd = startOfDay(addDays(renewalDate, catchUpDays))

    if (renewalDate > windowEnd || today > catchUpEnd) {
      skipped++
      continue
    }

    const reminder = {
      subscription_id: subscription.id,
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
  createReminderFromIntent,
  updateLatestReminderFromIntent,
  cancelReminderFromIntent,
  getPendingReminders,
  getUserReminders,
  getActiveReminders,
  markReminderSent,
  computeNextRenewalDate,
  computeReminderRenewalDate,
  resolveTriggerAt,
  dateFromIstParts,
  getIstPartsFromDate,
  mapReminderRow
}
