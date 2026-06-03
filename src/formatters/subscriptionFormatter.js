const { computeNextRenewalDate } = require('../services/reminderService')

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

function formatSubscription(subscription) {
  const fields = {
    renewalDay: subscription.renewalDay,
    renewalMonth: subscription.renewalMonth,
    recurrence: subscription.recurrence
  }
  const line2 = nextLine(fields) || scheduleLine(fields)
  const head = `• ${subscription.serviceName} — ₹${subscription.amount}/${cycleLabel(subscription.recurrence)}`
  return line2 ? `${head}\n${line2}` : head
}

function formatSubscriptionAdded(parsed) {
  return `✅ Subscription added

${parsed.serviceName}
₹${parsed.amount}/${cycleLabel(parsed.recurrence)}`
}

function formatSubscriptionUpdated(subscription) {
  return `✅ Subscription updated

${subscription.serviceName}
₹${subscription.amount}/${cycleLabel(subscription.recurrence)}`
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
