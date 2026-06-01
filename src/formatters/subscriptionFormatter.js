function formatSubscription(subscription) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `• ${subscription.serviceName} — ₹${subscription.amount}/${subscription.recurrence === 'monthly' ? 'month' : subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
}

function formatSubscriptionRemoved(subscription) {
  return `✅ Removed

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
  formatSubscriptionRemoved,
  formatSubscriptionOption
}
