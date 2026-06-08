/**
 * Subscription flow — create/update/delete/expiry. Business rules live here, not in intent detection.
 */
const { INTENTS, detectIntent } = require('../services/intentService')
const { handleSubscriptionMessage } = require('../services/subscriptionFlowService')
const {
  handleSubscriptionUpdateIntent,
  handleSubscriptionDeleteIntent,
  handleSubscriptionExpiryIntent
} = require('../controllers/queryController')
const { getPending, clearPending } = require('../services/pendingSubscriptionService')

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

async function executeCreate(sender, text, intent, reroute) {
  const cmd = detectIntent(text)
  if (isBlockedSubscriptionIntent(cmd, text)) {
    return reroute(cmd)
  }
  const saved = await handleSubscriptionMessage(sender, text)
  if (saved.blocked) {
    return reroute(cmd)
  }
  return { ...saved, intent: intent.intent }
}

async function executePending(sender, text, reroute) {
  const pending = await getPending(sender)
  if (!pending) return null
  const cmd = detectIntent(text)
  if (isBlockedSubscriptionIntent(cmd, text)) {
    await clearPending(sender)
    return reroute(cmd)
  }
  const saved = await handleSubscriptionMessage(sender, text)
  if (saved.blocked) {
    return reroute(cmd)
  }
  return { ...saved, intent: INTENTS.SUBSCRIPTION_CREATE }
}

async function executeIntent(sender, intent) {
  if (intent.intent === INTENTS.SUBSCRIPTION_UPDATE) {
    return handleSubscriptionUpdateIntent(sender, intent)
  }
  if (intent.intent === INTENTS.SUBSCRIPTION_DELETE) {
    return handleSubscriptionDeleteIntent(sender, intent)
  }
  if (intent.intent === INTENTS.SUBSCRIPTION_EXPIRY) {
    return handleSubscriptionExpiryIntent(sender, intent)
  }
  return null
}

module.exports = {
  executeCreate,
  executePending,
  executeIntent,
  isBlockedSubscriptionIntent
}
