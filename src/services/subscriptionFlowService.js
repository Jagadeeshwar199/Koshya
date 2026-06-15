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
const { formatSubscriptionAdded } = require('../formatters/subscriptionFormatter')
const { setLastEntity } = require('./entityContextService')
const logger = require('../../utils/logger')

const { detectIntent, INTENTS } = require('./intentService')
const { isValidAmount, MAX_SUBSCRIPTION_AMOUNT } = require('../utils/inputValidation')

function isBlockedSubscriptionIntent(intent, text = '') {
  const i = intent?.intent
  const t = String(text || intent?.rawText || '').trim().toLowerCase()
  if (/^(show|list)\s+(?:my\s+)?(?:all\s+)?subscriptions?\b/.test(t)) return true
  if (/^delete\s+all\s+reminders?\b/.test(t)) return true
  if (/^(hi|hello|start|help)\b/.test(t)) return true
  if (!i || i === INTENTS.UNKNOWN) return /^(delete|remove|cancel|show|list|help)\b/.test(t)
  if (i === INTENTS.HELP || i === INTENTS.CANCEL || i === INTENTS.LIST_MORE) return true
  if (i.endsWith('_QUERY') || i.endsWith('_DELETE') || i === INTENTS.DELETE_ENTITY) return true
  if (i === INTENTS.REMINDER_CANCEL || i === INTENTS.SUBSCRIPTION_EXPIRY) return true
  return false
}

function buildQuestions(missing) {
  const lines = []

  if (missing.includes('serviceName')) {
    lines.push('• Which service? (e.g. Netflix, Spotify)')
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
  return formatSubscriptionAdded(parsed)
}

async function saveAndReply(sender, parsed, text = '') {
  if (/^(show|delete|remove|cancel|list|help|all reminders|all subscriptions)/i.test(String(parsed.serviceName || ''))) {
    return { ok: false, blocked: true }
  }
  try {
    const { parseFirst } = require('./parseFirstService')
    const pf = parseFirst(text || parsed.serviceName)
    if (parsed.amount != null && !isValidAmount(parsed.amount)) {
      await sendWhatsAppMessage(
        sender,
        `That amount looks too large. Try a value up to ₹${MAX_SUBSCRIPTION_AMOUNT.toLocaleString('en-IN')}.`
      )
      return { ok: false, blocked: true }
    }
    const subscription = await createSubscriptionRecord({
      userPhone: sender,
      serviceName: parsed.serviceName,
      amount: parsed.amount,
      renewalDay: parsed.renewalDay,
      renewalMonth: parsed.renewalMonth,
      recurrence: parsed.recurrence,
      parseMeta: pf
    })

    await clearPending(sender)
    await setLastEntity(sender, 'subscription', subscription.id, {
      action: 'CREATE',
      title: parsed.serviceName,
      time: parsed.renewalDay ? `${parsed.renewalDay}th` : null
    })
    const reply = await sendWhatsAppMessage(
      sender,
      formatSubscriptionAdded({
        ...parsed,
        taskText: subscription.taskText || pf.taskText,
        scheduleText: subscription.scheduleText || pf.scheduleText
      })
    )

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
      `Couldn't save that. Try again:\nNetflix renews on 27th every month - 149`
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
    `${intro}\n\n${buildQuestions(missing)}\n\nExample: 149 monthly on 27th`
  )

  return { ok: true, asked: true }
}

async function handleSubscriptionMessage(sender, text) {
  const cmd = detectIntent(text)
  if (isBlockedSubscriptionIntent(cmd, text)) {
    return { ok: false, blocked: true }
  }
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
    return saveAndReply(sender, parsed, text)
  }

  if (parsed.type === 'incomplete') {
    const merged = mergePendingDrafts(pending, parsed.draft)
    const completed = finalizeDraft(merged)

    if (completed.type === 'subscription' && completed.success) {
      return saveAndReply(sender, completed, text)
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
      return saveAndReply(sender, completed, text)
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
