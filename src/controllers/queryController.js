const {
  resolveSubscriptionDelete,
  getUserSubscriptions,
  updateSubscription
} = require('../services/subscriptionService')
const { matchSubscriptionsByService } = require('../utils/serviceMatcher')
const { computeNextRenewalDate } = require('../services/reminderService')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { setState } = require('../services/conversationStateService')
const {
  formatSubscription,
  formatSubscriptionOption
} = require('../formatters/subscriptionFormatter')
const { HELP_TEXT, WELCOME_TEXT, SUB_SAVED_NEXT, clarifyLowConfidence, unknownReply } = require('../utils/uxMessages')
const { PAGE_SIZE } = require('./paginationController')

async function handleSubscriptionQueryIntent(sender, intent) {
  const subscriptions = await getUserSubscriptions(sender)
  const serviceName = intent.entities.serviceName?.toLowerCase()
  const filtered = serviceName
    ? matchSubscriptionsByService(subscriptions, intent.entities.serviceName)
    : subscriptions

  if (intent.entities.queryType === 'count') {
    const reply = await sendWhatsAppMessage(
      sender,
      `📺 You have ${filtered.length} subscription${filtered.length === 1 ? '' : 's'}.`
    )
    return { ok: true, intent: intent.intent, subscriptions: filtered, replySent: reply.success }
  }

  if (intent.entities.queryType === 'renews_next') {
    const ranked = filtered
      .map((sub) => ({ sub, date: computeNextRenewalDate(sub) }))
      .filter((row) => row.date)
      .sort((a, b) => a.date - b.date)
      .slice(0, PAGE_SIZE)
    const body = ranked.length
      ? ranked.map(({ sub }) => formatSubscription(sub)).join('\n')
      : 'No upcoming renewals.'
    const reply = await sendWhatsAppMessage(sender, `📺 Next renewals\n\n${body}`)
    return { ok: true, intent: intent.intent, subscriptions: filtered, replySent: reply.success }
  }

  if (intent.entities.queryType === 'renews_month') {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    const ranked = filtered
      .map((sub) => ({ sub, date: computeNextRenewalDate(sub) }))
      .filter((row) => row.date && row.date.getMonth() === month && row.date.getFullYear() === year)
      .sort((a, b) => a.date - b.date)
    const body = ranked.length
      ? ranked.map(({ sub }) => formatSubscription(sub)).join('\n')
      : 'Nothing renews this month.'
    const reply = await sendWhatsAppMessage(sender, `📺 This month\n\n${body}`)
    return { ok: true, intent: intent.intent, subscriptions: filtered, replySent: reply.success }
  }

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
  const { serviceName, amount } = intent.entities

  if (!serviceName) {
    const reply = await sendWhatsAppMessage(
      sender,
      `Which subscription?\n\nTry:\nUpdate Netflix to 199`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  const matches = matchSubscriptionsByService(await getUserSubscriptions(sender), serviceName)

  if (!matches.length) {
    const reply = await sendWhatsAppMessage(sender, `I couldn't find ${serviceName}.`)
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  if (matches.length > 1 && !amount) {
    const reply = await sendWhatsAppMessage(
      sender,
      `Send the full line:\n${serviceName} renews on 27th every month - 199`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  const updates = {}
  if (amount) updates.amount = amount

  if (!Object.keys(updates).length) {
    const reply = await sendWhatsAppMessage(
      sender,
      `Send the updated amount:\nUpdate ${serviceName} to 199`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  const updated = await updateSubscription(matches[0].id, updates)
  const reply = await sendWhatsAppMessage(
    sender,
    `✅ Updated\n\n${formatSubscription(updated)}`
  )

  return { ok: true, intent: intent.intent, subscription: updated, replySent: reply.success }
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
  const reply = await sendWhatsAppMessage(sender, HELP_TEXT)
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

async function handleUnknownIntent(sender, intent, text = '') {
  const reply = await sendWhatsAppMessage(sender, unknownReply(intent.rawText || text))
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

async function handleClarifyIntent(sender, intent) {
  const msg = clarifyLowConfidence(intent.intent) || unknownReply()
  const reply = await sendWhatsAppMessage(sender, msg)
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

module.exports = {
  handleSubscriptionDeleteIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent,
  WELCOME_TEXT
}
