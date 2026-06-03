const {
  resolveSubscriptionDelete,
  archiveSubscription,
  getUserSubscriptions,
  updateSubscription
} = require('../services/subscriptionService')
const {
  extractDeleteEntity,
  resolveUnifiedDelete,
  executeUnifiedDelete
} = require('../services/deleteResolverService')
const {
  formatReminderCancelConfirmation
} = require('../formatters/reminderFormatter')
const { unpackReminderMessage } = require('../services/reminderService')
const { matchSubscriptionsByService } = require('../utils/serviceMatcher')
const { computeNextRenewalDate } = require('../services/reminderService')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { setState } = require('../services/conversationStateService')
const {
  formatSubscription,
  formatSubscriptionOption,
  formatSubscriptionUpdated,
  formatSubscriptionRemoved
} = require('../formatters/subscriptionFormatter')
const { HELP_TEXT, WELCOME_TEXT, clarifyLowConfidence, unknownReply } = require('../utils/uxMessages')
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

  if (intent.entities.queryType === 'expiry') {
    const filtered = subscriptions.filter((sub) => {
      const name = intent.entities.serviceName
      return name
        ? sub.serviceName.toLowerCase().includes(name.toLowerCase())
        : true
    })
    const body = filtered.length
      ? filtered.map((sub) => formatSubscription(sub)).join('\n')
      : 'No matching subscriptions.'
    const reply = await sendWhatsAppMessage(sender, `Expiring soon\n\n${body}`)
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
    formatSubscriptionUpdated(updated)
  )

  return { ok: true, intent: intent.intent, subscription: updated, replySent: reply.success }
}

function formatDeleteChoice(candidate) {
  if (candidate.type === 'reminder') {
    const { title } = unpackReminderMessage(candidate.item.message)
    const label = title.charAt(0).toUpperCase() + title.slice(1)
    return `• ${label} reminder`
  }
  return `• ${candidate.item.serviceName} membership`
}

async function handleDeleteEntityIntent(sender, intent) {
  const entityName =
    intent.entities.serviceName || extractDeleteEntity(intent.rawText)

  const result = await resolveUnifiedDelete({
    userPhone: sender,
    entityName
  })

  if (result.status === 'needs_name') {
    const reply = await sendWhatsAppMessage(
      sender,
      `Delete what?\n\nTry:\ndelete Netflix\ndelete sleep`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  if (result.status === 'not_found') {
    const reply = await sendWhatsAppMessage(
      sender,
      `No match found.\n\nTry:\ndelete Netflix\ndelete sleep reminder`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  if (result.status === 'multiple') {
    const options = result.candidates.map(formatDeleteChoice).join('\n')
    const reply = await sendWhatsAppMessage(
      sender,
      `I found multiple matches:\n\n${options}\n\nWhich one?`
    )
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }

  const executed = await executeUnifiedDelete(result)
  const text =
    executed.type === 'reminder'
      ? formatReminderCancelConfirmation(executed.reminder)
      : formatSubscriptionRemoved(executed.subscription)
  const reply = await sendWhatsAppMessage(sender, text)
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

async function handleSubscriptionDeleteIntent(sender, intent) {
  const result = await resolveSubscriptionDelete({
    userPhone: sender,
    serviceName: intent.entities.serviceName
  })

  if (result.status === 'needs_service_name') {
    const reply = await sendWhatsAppMessage(
      sender,
      `Which subscription?\n\nTry:\nremove Netflix`
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
      `No subscription found.`
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
      `Which subscription?\n\n${options}`
    )

    return {
      ok: true,
      intent: intent.intent,
      subscriptions: result.subscriptions,
      replySent: reply.success
    }
  }

  const subscription = await archiveSubscription(result.subscription.id)
  const reply = await sendWhatsAppMessage(
    sender,
    formatSubscriptionRemoved(subscription)
  )

  return {
    ok: true,
    intent: intent.intent,
    subscription,
    replySent: reply.success
  }
}

async function handleHelpIntent(sender, intent) {
  const text = /^(hi|hello|start)$/i.test(intent.rawText || '') ? WELCOME_TEXT : HELP_TEXT
  const reply = await sendWhatsAppMessage(sender, text)
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
  handleDeleteEntityIntent,
  handleSubscriptionDeleteIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent,
  WELCOME_TEXT
}
