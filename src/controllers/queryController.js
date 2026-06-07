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
const { setPendingConfirmation } = require('../services/pendingConfirmationService')
const { CLARIFY_UPDATE } = require('../services/entityUpdateCoercion')
const { getLastEntity, clearDialogueState } = require('../services/entityContextService')
const {
  formatSubscription,
  formatSubscriptionOption,
  formatSubscriptionUpdated,
  formatSubscriptionRemoved
} = require('../formatters/subscriptionFormatter')
const { registerService } = require('../intent/serviceCatalog')
const { HELP_TEXT, WELCOME_TEXT, clarifyLowConfidence, ambiguousShortReply, unknownReply } = require('../utils/uxMessages')
const { PAGE_SIZE } = require('./paginationController')

async function handleSubscriptionExpiryIntent(sender, intent) {
  const name = intent.entities.serviceName
  const subs = await getUserSubscriptions(sender)
  const matched = name ? matchSubscriptionsByService(subs, name) : []

  if (matched.length) {
    const reply = await sendWhatsAppMessage(sender, `📅 Expiry\n\n${formatSubscription(matched[0])}`)
    return { ok: true, intent: 'SUBSCRIPTION_EXPIRY', subscriptions: matched, replySent: reply.success }
  }

  if (name) {
    registerService(name)
  }
  const reply = await sendWhatsAppMessage(
    sender,
    `${name || 'That service'} isn't tracked yet.\n\nAdd:\n${name} renews on 27th every month - 149`
  )
  return { ok: true, intent: 'SUBSCRIPTION_EXPIRY', subscriptions: [], replySent: reply.success }
}

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
    const ranked = filtered
      .map((sub) => ({ sub, date: computeNextRenewalDate(sub) }))
      .filter((row) => row.date)
      .sort((a, b) => a.date - b.date)
      .slice(0, PAGE_SIZE)
    const body = ranked.length
      ? ranked.map(({ sub }) => formatSubscription(sub)).join('\n')
      : 'Nothing expiring soon.'
    const reply = await sendWhatsAppMessage(sender, `📅 Expiring soon\n\n${body}`)
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
  const renewalDay =
    intent.entities?.renewalDay ||
    (intent.entities?.date?.day ? Number(intent.entities.date.day) : null)
  const lastId = intent.lastEntityId || (await getLastEntity(sender))?.id

  if (lastId && renewalDay) {
    const updated = await updateSubscription(lastId, { renewalDay })
    await clearDialogueState(sender)
    const reply = await sendWhatsAppMessage(sender, formatSubscriptionUpdated(updated))
    return { ok: true, intent: intent.intent, subscription: updated, replySent: reply.success }
  }

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

  if (!Object.keys(updates).length && /\bexpiry\b/i.test(intent.rawText || '') && intent.entities.date) {
    const reply = await sendWhatsAppMessage(
      sender,
      `📅 Updated ${serviceName} expiry.\n\n${formatSubscription(matches[0])}`
    )
    return { ok: true, intent: intent.intent, subscription: matches[0], replySent: reply.success }
  }

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

async function handleClarifyUpdate(sender, intent) {
  const { INTENTS } = require('../services/intentService')
  await setPendingConfirmation(sender, {
    pending_intent: intent.pending_intent || intent.execution_intent || INTENTS.REMINDER_RESCHEDULE,
    target_id: intent.lastEntityId,
    proposed_changes: intent.entities || {}
  })
  const reply = await sendWhatsAppMessage(sender, intent.clarificationText || 'Do you want to update your reminder?')
  return { ok: true, intent: CLARIFY_UPDATE, replySent: reply.success }
}

async function handlePendingConfirmationDecline(sender) {
  const reply = await sendWhatsAppMessage(sender, "Okay, I won't change it.")
  return { ok: true, intent: 'CANCEL', replySent: reply.success }
}

async function handleDetectionClarify(sender, intent, clarificationText) {
  const reply = await sendWhatsAppMessage(sender, clarificationText || 'Can you share a bit more detail?')
  return { ok: true, intent: intent?.intent || 'CLARIFY', replySent: reply.success }
}

async function handleClarifyIntent(sender, intent) {
  const msg =
    intent.entities.clarify === 'short'
      ? ambiguousShortReply(intent.entities.serviceName)
      : clarifyLowConfidence(intent.intent) || unknownReply()
  const reply = await sendWhatsAppMessage(sender, msg)
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

async function handleUnknownIntent(sender, intent, text = '') {
  if (intent.entities.clarify === 'short') {
    const reply = await sendWhatsAppMessage(sender, ambiguousShortReply(intent.entities.serviceName))
    return { ok: true, intent: intent.intent, replySent: reply.success }
  }
  const reply = await sendWhatsAppMessage(sender, unknownReply(intent.rawText || text))
  return { ok: true, intent: intent.intent, replySent: reply.success }
}

module.exports = {
  handleDeleteEntityIntent,
  handleSubscriptionDeleteIntent,
  handleSubscriptionExpiryIntent,
  handleSubscriptionQueryIntent,
  handleSubscriptionUpdateIntent,
  handleHelpIntent,
  handleUnknownIntent,
  handleClarifyIntent,
  handleDetectionClarify,
  handleClarifyUpdate,
  handlePendingConfirmationDecline,
  WELCOME_TEXT
}
