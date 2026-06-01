const {
  parseMessage,
  mergePendingDrafts,
  finalizeDraft,
  getMissing
} = require('./parserService')
const { createSubscriptionRecord } = require('./subscriptionService')
const {
  getPending,
  setPending,
  clearPending
} = require('./pendingSubscriptionService')
const { sendWhatsAppMessage } = require('./whatsappService')
const { computeNextRenewalDate } = require('./reminderService')
const logger = require('../../utils/logger')

function buildQuestions(missing) {
  const lines = []

  if (missing.includes('serviceName')) {
    lines.push('• Which service? (e.g. Netflix, Spotify)')
  }
  if (missing.includes('amount')) {
    lines.push('• What amount in ₹? (e.g. 149)')
  }
  if (missing.includes('recurrence')) {
    lines.push('• How often? Reply: monthly, yearly, or every 3 months')
  }
  if (missing.includes('renewalDate')) {
    lines.push('• Renewal date? (e.g. 27th or Jan 20)')
  }

  return lines.join('\n')
}

function formatSaved(parsed) {
  const renewalDate = computeNextRenewalDate({
    renewal_day: parsed.renewalDay,
    renewal_month: parsed.renewalMonth,
    recurrence: parsed.recurrence
  })
  const renewalLabel = renewalDate
    ? renewalDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      })
    : parsed.renewalDay

  return `✅ Added

${parsed.serviceName}
₹${parsed.amount}/${parsed.recurrence === 'monthly' ? 'month' : parsed.recurrence}

Renews ${renewalLabel}`
}

async function saveAndReply(sender, parsed) {
  try {
    const subscription = await createSubscriptionRecord({
      userPhone: sender,
      serviceName: parsed.serviceName,
      amount: parsed.amount,
      renewalDay: parsed.renewalDay,
      renewalMonth: parsed.renewalMonth,
      recurrence: parsed.recurrence
    })

    await clearPending(sender)
    const reply = await sendWhatsAppMessage(sender, formatSaved(parsed))

    if (!reply.success) {
      logger.warn('subscription.confirmation_failed', {
        userPhone: sender,
        subscriptionId: subscription?.id,
        error: reply.error
      })
    }

    logger.info('subscription.saved', {
      userPhone: sender,
      subscriptionId: subscription?.id,
      serviceName: parsed.serviceName,
      replySent: reply.success
    })

    return {
      ok: true,
      subscription,
      replySent: reply.success
    }
  } catch (err) {
    logger.error('subscription.save_failed', {
      userPhone: sender,
      error: err.message || err
    })
    await sendWhatsAppMessage(
      sender,
      'I could not save that.\n\nPlease try again.'
    )
    return { ok: false }
  }
}

async function askForMissing(sender, draft) {
  const missing = getMissing(draft)

  await setPending(sender, draft)

  const intro = draft.serviceName
    ? `Got ${draft.serviceName}. I need a bit more:`
    : `Almost there — I need:`

  await sendWhatsAppMessage(
    sender,
    `${intro}\n\n${buildQuestions(missing)}\n\nReply in one message, e.g. "149 monthly on 27th"`
  )

  return { ok: true, asked: true }
}

async function handleSubscriptionMessage(sender, text) {
  const pending = await getPending(sender)

  logger.info('subscription.pending_loaded', {
    userPhone: sender,
    hasPending: Boolean(pending)
  })

  const parsed = parseMessage(text, pending)

  logger.info('subscription.message_parsed', {
    userPhone: sender,
    type: parsed.type,
    success: parsed.success,
    serviceName: parsed.serviceName || parsed.draft?.serviceName
  })

  if (parsed.type === 'subscription' && parsed.success) {
    return saveAndReply(sender, parsed)
  }

  if (parsed.type === 'incomplete') {
    const merged = mergePendingDrafts(pending, parsed.draft)
    const completed = finalizeDraft(merged)

    if (completed.type === 'subscription' && completed.success) {
      return saveAndReply(sender, completed)
    }

    return askForMissing(sender, merged)
  }

  if (pending) {
    const fallback = parseMessage(text)
    const partial =
      fallback.type === 'incomplete' ? fallback.draft : {}

    const merged = mergePendingDrafts(pending, partial)
    const completed = finalizeDraft(merged)

    if (completed.type === 'subscription' && completed.success) {
      return saveAndReply(sender, completed)
    }

    return askForMissing(sender, merged)
  }

  await sendWhatsAppMessage(
    sender,
    `⚠️ Could not understand subscription.

Examples:
Netflix renews on 27th every month - 149
JioHotstar renews on Apr 12 every 3 months - 599`
  )
  return { ok: true, unknown: true }
}

module.exports = {
  handleSubscriptionMessage,
  buildQuestions
}
