const {
  archiveSubscriptionFromIntent,
  getUserSubscriptions
} = require('../services/subscriptionService')
const { sendWhatsAppMessage } = require('../../services/whatsappService')

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

async function handleSubscriptionQueryIntent(sender, intent) {
  const subscriptions = await getUserSubscriptions(sender)
  const serviceName = intent.entities.serviceName?.toLowerCase()
  const filtered = serviceName
    ? subscriptions.filter((subscription) =>
        subscription.serviceName.toLowerCase().includes(serviceName)
      )
    : subscriptions

  const visible = filtered.slice(0, 5)
  const body = visible.length
    ? `${visible.map(formatSubscription).join('\n')}${filtered.length > 5 ? '\n\nReply:\nmore' : ''}`
    : `No subscriptions yet.

Try:
Netflix renews on 27th every month - 149`

  const reply = await sendWhatsAppMessage(sender, `📺 Subscriptions\n\n${body}`)

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
    `Send the updated subscription:

Netflix renews on 27th every month - 199`
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
      `Which subscription should I remove?\n\nTry:\nremove Netflix subscription`
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
      `Which subscription should I remove?\n\n${options}\n\nReply with the subscription name.`
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

I help you track subscriptions and reminders.

Subscriptions

Netflix renews on 27th every month - 149

Reminders

Remind me to exercise tomorrow

Queries

Show reminders

Show Netflix reminder`
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
    `I didn't get that.

Try:
• remind me tomorrow
• show reminders
• help`
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
