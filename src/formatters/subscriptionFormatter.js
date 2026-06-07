const { computeNextRenewalDate } = require('../services/reminderService')
const { formatGotIt } = require('./unifiedUxFormatter')

function cycleLabel(recurrence) {
  if (recurrence === 'monthly') {
    return 'month'
  }
  if (recurrence === 'yearly') {
    return 'year'
  }
  return recurrence
}

function ordinal(day) {
  const n = Number(day)
  if (!Number.isInteger(n)) {
    return String(day)
  }
  const mod = n % 100
  const suffix =
    mod >= 11 && mod <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]
  return `${n}${suffix}`
}

function scheduleLine(fields) {
  const day = fields.renewalDay
  if (fields.recurrence === 'monthly' && day) {
    return `Renews every month on ${ordinal(day)}`
  }
  if (fields.recurrence === 'yearly' && day && fields.renewalMonth) {
    return `Renews every year on ${ordinal(day)} ${fields.renewalMonth}`
  }
  if (day) {
    const when = fields.renewalMonth
      ? `${ordinal(day)} ${fields.renewalMonth}`
      : ordinal(day)
    return `Renews on ${when}`
  }
  return ''
}

function nextLine(fields) {
  const date = computeNextRenewalDate({
    renewal_day: fields.renewalDay,
    renewal_month: fields.renewalMonth,
    recurrence: fields.recurrence
  })
  if (!date) {
    return ''
  }
  return `Next: ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
}

function formatScheduleShort(fields) {
  const cycle =
    fields.recurrence === 'monthly'
      ? 'Every month'
      : fields.recurrence === 'yearly'
        ? 'Every year'
        : fields.recurrence
          ? `Every ${fields.recurrence}`
          : ''
  if (cycle && fields.renewalDay) {
    return `${cycle} · ${ordinal(fields.renewalDay)}`
  }
  return scheduleLine(fields)
}

function formatSubscription(subscription) {
  const fields = {
    renewalDay: subscription.renewalDay,
    renewalMonth: subscription.renewalMonth,
    recurrence: subscription.recurrence
  }
  const line2 = nextLine(fields) || scheduleLine(fields)
  const head =
    subscription.amount != null
      ? `• ${subscription.serviceName} — ₹${subscription.amount}/${cycleLabel(subscription.recurrence)}`
      : `• ${subscription.serviceName}`
  return line2 ? `${head}\n${line2}` : head
}

function formatSubscriptionAdded(parsed) {
  const task = parsed.taskText || parsed.serviceName
  const schedule = parsed.scheduleText || formatScheduleShort(parsed)
  return formatGotIt(task, schedule)
}

function formatSubscriptionUpdated(subscription) {
  const task = subscription.taskText || subscription.serviceName
  const schedule = subscription.scheduleText || formatScheduleShort(subscription)
  return formatGotIt(task, schedule)
}

function formatSubscriptionRemoved(subscription) {
  return `🗑️ Subscription deleted

${subscription.serviceName}`
}

function formatSubscriptionOption(subscription, index) {
  return `${index + 1}. ${formatSubscription(subscription).replace(/^•\s*/, '')}`
}

module.exports = {
  formatSubscription,
  formatSubscriptionAdded,
  formatSubscriptionUpdated,
  formatSubscriptionRemoved,
  formatSubscriptionOption,
  scheduleLine,
  nextLine
}
