const { SUB_SAVED_NEXT } = require('../utils/uxMessages')

function formatSubscription(subscription) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `• ${subscription.serviceName} — ₹${subscription.amount}/${subscription.recurrence === 'monthly' ? 'month' : subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
}

function formatSubscriptionAdded(parsed, renewalLabel) {
  const cycle = parsed.recurrence === 'monthly' ? 'month' : parsed.recurrence

  return `✅ Subscription added

${parsed.serviceName}
₹${parsed.amount}/${cycle}
Renews ${renewalLabel}${SUB_SAVED_NEXT}`
}

function formatSubscriptionUpdated(subscription) {
  const cycle = subscription.recurrence === 'monthly' ? 'month' : subscription.recurrence

  return `✅ Subscription updated

${subscription.serviceName}
₹${subscription.amount}/${cycle}${SUB_SAVED_NEXT}`
}

function formatSubscriptionRemoved(subscription) {
  return `✅ Subscription removed

${subscription.serviceName}`
}

function formatSubscriptionOption(subscription, index) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `${index + 1}. ${subscription.serviceName} — ₹${subscription.amount}/${subscription.recurrence === 'monthly' ? 'month' : subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
}

module.exports = {
  formatSubscription,
  formatSubscriptionAdded,
  formatSubscriptionUpdated,
  formatSubscriptionRemoved,
  formatSubscriptionOption
}
