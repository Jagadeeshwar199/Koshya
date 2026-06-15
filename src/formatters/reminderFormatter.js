const { formatGotIt } = require('./unifiedUxFormatter')
const {
  computeNextRenewalDate,
  unpackReminderMessage,
  normalizeReminderTitle,
  resolveTriggerAt
} = require('../services/reminderService')

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
    return { dateLabel: 'No time set', timeLabel: '' }
  }

  const triggerDate = new Date(triggerAt)
  const parts = getIstParts(triggerDate)
  const time = parts.minute === '00'
    ? `${parts.hour}:00 ${parts.dayPeriod.toUpperCase()}`
    : `${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`
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
    dateLabel: `${parts.day} ${parts.month}`,
    timeLabel: time
  }
}

function formatReminderScheduleLine(reminder, now = new Date()) {
  const { daily } = unpackReminderMessage(reminder.message)
  const formatted = formatReminderTime(reminder.triggerAt, now)

  if (daily) {
    return `Every day · ${formatted.timeLabel}`
  }

  const diffMs = new Date(reminder.triggerAt).getTime() - now.getTime()
  if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(diffMs / 60000))
    if (minutes < 180) {
      return `In ${minutes} minute${minutes === 1 ? '' : 's'}`
    }
  }

  return `${formatted.dateLabel} · ${formatted.timeLabel}`
}

function displayReminderTitle(message) {
  const { title } = unpackReminderMessage(message)
  return normalizeReminderTitle(title)
}

function formatReminderListTime(triggerAt, now = new Date()) {
  return formatReminderScheduleLine({ message: '', triggerAt }, now)
}

function formatReminderConfirmation(reminder, now = new Date()) {
  const task = reminder.taskText || displayReminderTitle(reminder.message)
  const schedule = reminder.scheduleText || formatReminderScheduleLine(reminder, now)
  return formatGotIt(task, schedule)
}

function formatReminderUpdateConfirmation(reminder, now = new Date()) {
  const task = reminder.taskText || displayReminderTitle(reminder.message)
  const schedule = reminder.scheduleText || formatReminderScheduleLine(reminder, now)
  return formatGotIt(task, schedule)
}

function formatReminderCancelConfirmation(reminder) {
  return `🗑️ Reminder deleted

${displayReminderTitle(reminder.message)}`
}

function formatManualReminderSummary(reminder, now = new Date()) {
  return `• ${displayReminderTitle(reminder.message)}
${formatReminderScheduleLine(reminder, now)}`
}

function formatReminderOption(reminder, index, now = new Date()) {
  return `${index + 1}. ${displayReminderTitle(reminder.message)} — ${formatReminderScheduleLine(reminder, now)}`
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

function formatSubscriptionReminderDetail(subscription) {
  return `📺 ${subscription.serviceName}

₹${subscription.amount}/${recurrenceLabel(subscription.recurrence)}
Renews ${subscription.renewalDay}${subscription.renewalMonth ? ` ${subscription.renewalMonth}` : ''}`
}

function formatSubscriptionReminderSummary(subscription, now = new Date()) {
  const reminderDate = subscriptionToReminderDate(subscription)

  if (!reminderDate) {
    return null
  }

  return `• ${subscription.serviceName} — ${formatReminderListTime(reminderDate, now)}`
}

function reminderMatchesDate(reminder, dateEntity, now = new Date()) {
  if (!dateEntity || !reminder.triggerAt) {
    return true
  }

  const target = resolveTriggerAt(dateEntity, now)
  return getIstDateKey(new Date(reminder.triggerAt)) === getIstDateKey(target)
}

module.exports = {
  formatReminderTime,
  formatReminderListTime,
  formatReminderScheduleLine,
  formatReminderConfirmation,
  formatReminderUpdateConfirmation,
  formatReminderCancelConfirmation,
  formatManualReminderSummary,
  formatReminderOption,
  formatSubscriptionReminderDetail,
  formatSubscriptionReminderSummary,
  reminderMatchesDate,
  getIstDateKey,
  subscriptionToReminderDate,
  displayReminderTitle
}
