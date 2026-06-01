const {
  resolveSubscriptionDelete,
  getUserSubscriptions
} = require('../services/subscriptionService')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { setState } = require('../services/conversationStateService')
const {
  formatSubscription,
  formatSubscriptionOption
} = require('../formatters/subscriptionFormatter')
const { PAGE_SIZE } = require('./paginationController')

async function handleSubscriptionQueryIntent(sender, intent) {
  const subscriptions = await getUserSubscriptions(sender)
  const serviceName = intent.entities.serviceName?.toLowerCase()
  const filtered = serviceName
    ? subscriptions.filter((subscription) =>
        subscription.serviceName.toLowerCase().includes(serviceName)
      )
    : subscriptions

  const formattedItems = filtered.map(formatSubscription)
  const visible = formattedItems.slice(0, PAGE_SIZE)
  const body = visible.length
    ? `${visible.join('\n')}${filtered.length > PAGE_SIZE ? '\n\nReply:\nmore' : ''}`
    : `No subscriptions yet.

Try:
Netflix renews on 27th every month - 149`

  if (filtered.length > PAGE_SIZE) {
    await setState(sender, {
      listType: 'subscriptions',
      items: formattedItems,
      offset: PAGE_SIZE
    })
  }

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
  const result = await resolveSubscriptionDelete({
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

  await setState(sender, {
    action: 'confirm_delete',
    subscriptionId: result.subscription.id,
    serviceName: result.subscription.serviceName
  })

  const reply = await sendWhatsAppMessage(
    sender,
    `Remove ${result.subscription.serviceName}?

Reply:
YES to confirm
NO to cancel`
  )

  return {
    ok: true,
    intent: intent.intent,
    subscription: result.subscription,
    awaitingConfirmation: true,
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
