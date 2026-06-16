const { applyTypoFixes } = require('../utils/textUtils')

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const IST_OFFSET_MINUTES = 330
const LEGACY_DAILY_PREFIX = '[d]'

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
    Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0) -
      IST_OFFSET_MINUTES * 60 * 1000
  )
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function addMonthsToParts(parts, months) {
  const monthIndex = parts.month + months
  const year = parts.year + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const day = Math.min(parts.day, daysInMonth(year, month))
  return { ...parts, year, month, day }
}

function serializeRecurrenceSchedule(schedule) {
  return JSON.stringify({ v: 1, ...schedule })
}

function parseRecurrenceSchedule(scheduleText, message = '') {
  const raw = String(scheduleText || '').trim()
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.v === 1 && parsed.kind) return parsed
    } catch (_) {
      return null
    }
  }
  if (String(message || '').startsWith(LEGACY_DAILY_PREFIX)) {
    return { v: 1, kind: 'daily' }
  }
  return null
}

function inferRecurrenceSchedule(message, entities = {}, triggerAt = new Date()) {
  const text = applyTypoFixes(String(message || ''))
  const lower = text.toLowerCase()
  const parts = getIstPartsFromDate(triggerAt)
  const hour = entities.date?.time?.hour ?? parts.hour
  const minute = entities.date?.time?.minute ?? parts.minute

  if (/\b(?:daily|every\s+day|everyday)\b/i.test(lower) || entities.recurrence === 'daily') {
    return { kind: 'daily', hour, minute }
  }

  const weekdayMatch = lower.match(
    /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
  )
  if (weekdayMatch) {
    return { kind: 'weekly', weekday: weekdayMatch[1].toLowerCase(), hour, minute }
  }
  if (WEEKDAYS.includes(String(entities.recurrence || '').toLowerCase())) {
    return { kind: 'weekly', weekday: String(entities.recurrence).toLowerCase(), hour, minute }
  }

  if (entities.recurrence === 'monthly' || /\bevery\s+month\b/i.test(lower)) {
    const day = Number(entities.date?.day ?? parts.day)
    return { kind: 'monthly', day, hour, minute }
  }

  return null
}

function computeNextRecurringTriggerAt(schedule, fromDate) {
  const base = getIstPartsFromDate(fromDate)
  const hour = schedule.hour ?? base.hour
  const minute = schedule.minute ?? base.minute
  const parts = { ...base, hour, minute }

  if (schedule.kind === 'daily') {
    return dateFromIstParts({ ...parts, day: parts.day + 1 })
  }
  if (schedule.kind === 'weekly') {
    return dateFromIstParts({ ...parts, day: parts.day + 7 })
  }
  if (schedule.kind === 'monthly') {
    const day = Number(schedule.day ?? parts.day)
    const next = addMonthsToParts(parts, 1)
    return dateFromIstParts({ ...next, day: Math.min(day, daysInMonth(next.year, next.month)) })
  }
  return null
}

function isRecurringUserReminder(reminder) {
  if (!reminder || reminder.subscription_id) return false
  return Boolean(parseRecurrenceSchedule(reminder.schedule_text, reminder.message))
}

function buildDeliveryUpdate(reminder, deliveredAt = new Date()) {
  if (reminder.subscription_id) {
    return { status: 'sent', sent_at: deliveredAt.toISOString() }
  }

  const schedule = parseRecurrenceSchedule(reminder.schedule_text, reminder.message)
  if (!schedule) {
    return { status: 'sent', sent_at: deliveredAt.toISOString() }
  }

  const next = computeNextRecurringTriggerAt(schedule, new Date(reminder.trigger_at))
  if (!next) {
    return { status: 'sent', sent_at: deliveredAt.toISOString() }
  }

  return {
    status: 'pending',
    trigger_at: next.toISOString(),
    sent_at: deliveredAt.toISOString(),
    retry_count: 0
  }
}

function formatRecurrenceDisplay(schedule) {
  if (!schedule) return ''
  const hour = Number(schedule.hour ?? 10)
  const minute = Number(schedule.minute ?? 0)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  const time =
    minute > 0 ? `${h}:${String(minute).padStart(2, '0')} ${ampm}` : `${h} ${ampm}`

  if (schedule.kind === 'daily') return minute > 0 ? `Every day · ${time}` : 'Every day'
  if (schedule.kind === 'weekly') {
    const day = String(schedule.weekday || 'monday')
    const label = day.charAt(0).toUpperCase() + day.slice(1)
    return minute > 0 ? `Every ${label} · ${time}` : `Every ${label}`
  }
  if (schedule.kind === 'monthly') {
    const d = Number(schedule.day)
    const suffix =
      d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'
    return `Every month on ${d}${suffix}`
  }
  return ''
}

module.exports = {
  serializeRecurrenceSchedule,
  parseRecurrenceSchedule,
  inferRecurrenceSchedule,
  computeNextRecurringTriggerAt,
  isRecurringUserReminder,
  buildDeliveryUpdate,
  formatRecurrenceDisplay,
  LEGACY_DAILY_PREFIX
}
