const { getUserSubscriptions } = require('../services/subscriptionService')
const { sendWhatsAppMessage } = require('../../services/whatsappService')

function formatSubscription(subscription) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `• ${subscription.serviceName} - Rs ${subscription.amount}, ${subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
}

async function handleSubscriptionQueryIntent(sender, intent) {
  const subscriptions = await getUserSubscriptions(sender)
  const serviceName = intent.entities.serviceName?.toLowerCase()
  const filtered = serviceName
    ? subscriptions.filter((subscription) =>
        subscription.serviceName.toLowerCase().includes(serviceName)
      )
    : subscriptions

  const body = filtered.length
    ? filtered.map(formatSubscription).join('\n')
    : 'No subscriptions found.'

  const reply = await sendWhatsAppMessage(sender, `📦 Subscriptions\n\n${body}`)

  return {
    ok: true,
    intent: intent.intent,
    subscriptions: filtered,
    replySent: reply.success
  }
}

async function handleSubscriptionUpdateIntent(sender, intent) {
  const reply = await sendWhatsAppMessage(
    sender,
    `I can update subscriptions soon. For now, send the full updated subscription like:\n\nNetflix renews on 27th every month - 199`
  )

  return {
    ok: true,
    intent: intent.intent,
    replySent: reply.success
  }
}

async function handleHelpIntent(sender, intent) {
  const reply = await sendWhatsAppMessage(
    sender,
`I can help with:

• Add subscriptions
• Show subscriptions
• Create reminders
• Show reminders

Example:
Netflix renews on 27th every month - 149`
  )

  return {
    ok: true,
    intent: intent.intent,
    replySent: reply.success
  }
}

async function handleUnknownIntent(sender, intent) {
  const reply = await sendWhatsAppMessage(
    sender,
    `I could not understand that yet. Reply "help" to see what I can do.`
  )

  return {
    ok: true,
    intent: intent.intent,
    replySent: reply.success
  }
}

module.exports = {
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent
}
