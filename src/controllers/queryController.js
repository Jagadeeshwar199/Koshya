const {
  archiveSubscriptionFromIntent,
  getUserSubscriptions
} = require('../services/subscriptionService')
const { sendWhatsAppMessage } = require('../../services/whatsappService')

function formatSubscription(subscription) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `• ${subscription.serviceName} - Rs ${subscription.amount}, ${subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
}

function formatSubscriptionRemoved(subscription) {
  return `✅ Subscription removed

${subscription.serviceName}

₹${subscription.amount}/${subscription.recurrence === 'monthly' ? 'month' : subscription.recurrence}

Future renewal reminders will no longer be sent.`
}

function formatSubscriptionOption(subscription, index) {
  const datePart = [subscription.renewalMonth, subscription.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `${index + 1}. ${subscription.serviceName} — ₹${subscription.amount}, ${subscription.recurrence}${datePart ? `, renews ${datePart}` : ''}`
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

async function handleSubscriptionDeleteIntent(sender, intent) {
  const result = await archiveSubscriptionFromIntent({
    userPhone: sender,
    serviceName: intent.entities.serviceName
  })

  if (result.status === 'needs_service_name') {
    const reply = await sendWhatsAppMessage(
      sender,
      `Which subscription should I remove?\n\nTry: remove Netflix subscription`
    )

    return {
      ok: true,
      intent: intent.intent,
      subscriptions: [],
      replySent: reply.success
    }
  }

  if (result.status === 'not_found') {
    const reply = await sendWhatsAppMessage(
      sender,
      `I couldn't find that subscription.`
    )

    return {
      ok: true,
      intent: intent.intent,
      subscriptions: [],
      replySent: reply.success
    }
  }

  if (result.status === 'multiple') {
    const options = result.subscriptions
      .map(formatSubscriptionOption)
      .join('\n')
    const reply = await sendWhatsAppMessage(
      sender,
      `Which subscription should I remove?\n\n${options}`
    )

    return {
      ok: true,
      intent: intent.intent,
      subscriptions: result.subscriptions,
      replySent: reply.success
    }
  }

  const reply = await sendWhatsAppMessage(
    sender,
    formatSubscriptionRemoved(result.subscription)
  )

  return {
    ok: true,
    intent: intent.intent,
    subscription: result.subscription,
    replySent: reply.success
  }
}

async function handleHelpIntent(sender, intent) {
  const reply = await sendWhatsAppMessage(
    sender,
`👋 I'm Koshya

I help you track subscriptions and personal reminders through WhatsApp.

Examples:

📺 Subscriptions

Netflix renews on 27th every month - 149

Spotify monthly 119 on 15th

🔔 Reminders

Remind me to exercise tomorrow

Remind me to pay rent on June 5

📋 Queries

What reminders do I have tomorrow?

Show Netflix reminder

List subscriptions

⚙️ Updates

change to 7 PM

cancel exercise reminder

remove Netflix subscription`
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
  handleSubscriptionDeleteIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent
}
