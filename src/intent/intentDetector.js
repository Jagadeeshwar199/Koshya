const {
  normalizeText,
  normalizeForIntentMatch,
  applyTypoFixes
} = require('../utils/textUtils')
const {
  REMINDER_TERMS,
  SUBSCRIPTION_TERMS,
  EXPIRY_TERMS,
  PAYMENT_TERMS,
  ACTION_VERBS,
  QUERY_TERMS,
  DELETE_TERMS,
  UPDATE_TERMS,
  DEFAULT_FUZZY_THRESHOLD
} = require('./semanticDictionaries')
const { groupScore } = require('./fuzzyMatcher')
const { extractEntities, extractOffset } = require('./entityExtractor')

const INTENTS = {
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATE',
  SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATE',
  SUBSCRIPTION_DELETE: 'SUBSCRIPTION_DELETE',
  SUBSCRIPTION_QUERY: 'SUBSCRIPTION_QUERY',
  SUBSCRIPTION_EXPIRY: 'SUBSCRIPTION_EXPIRY',
  REMINDER_CREATE: 'REMINDER_CREATE',
  REMINDER_UPDATE: 'REMINDER_UPDATE',
  REMINDER_RESCHEDULE: 'REMINDER_RESCHEDULE',
  REMINDER_CANCEL: 'REMINDER_CANCEL',
  DELETE_ENTITY: 'DELETE_ENTITY',
  REMINDER_QUERY: 'REMINDER_QUERY',
  HELP: 'HELP',
  LIST_MORE: 'LIST_MORE',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  UNKNOWN: 'UNKNOWN'
}

const MIN_CONFIDENCE = Number(process.env.INTENT_MIN_CONFIDENCE || 0.45)

function clamp(value, max = 0.99) {
  return Math.min(max, Math.max(0, value))
}

function hasFutureSchedule(entities) {
  return Boolean(entities.date)
}

function isReminderUpdateText(text) {
  if (/\bremind\s+me\b/.test(text)) {
    return false
  }

  return (
    /\b(?:change|make|set|move|update|reschedule)\b/.test(text) &&
    (
      /\b(?:reminder|it)\b/.test(text) ||
      /\b(?:am|pm|morning|afternoon|evening|tomorrow|today|sunday|monday|tuesday|wednesday|thursday|friday|saturday|next\s+(?:week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/.test(text)
    )
  )
}

function isReminderReschedulePhrase(lower, entities) {
  return (
    /^change\s+to\b/i.test(lower) ||
    (/^make\s+it\b/i.test(lower) && entities.date) ||
    isReminderUpdateText(lower)
  )
}

function scoreSignals(text, lower, entities, threshold) {
  const reminderSemantic = groupScore(lower, REMINDER_TERMS, threshold)
  const subscriptionSemantic = groupScore(lower, SUBSCRIPTION_TERMS, threshold)
  const expirySemantic = groupScore(lower, EXPIRY_TERMS, threshold)
  const paymentSemantic = groupScore(lower, PAYMENT_TERMS, threshold)
  const actionSemantic = groupScore(lower, ACTION_VERBS, threshold)
  const querySemantic = groupScore(lower, QUERY_TERMS, threshold)
  const deleteSemantic = groupScore(lower, DELETE_TERMS, threshold)
  const updateSemantic = groupScore(lower, UPDATE_TERMS, threshold)

  const scores = {
    [INTENTS.HELP]: 0,
    [INTENTS.LIST_MORE]: 0,
    [INTENTS.CONFIRM]: 0,
    [INTENTS.CANCEL]: 0,
    [INTENTS.REMINDER_CANCEL]: 0,
    [INTENTS.SUBSCRIPTION_DELETE]: 0,
    [INTENTS.DELETE_ENTITY]: 0,
    [INTENTS.REMINDER_CREATE]: 0,
    [INTENTS.REMINDER_RESCHEDULE]: 0,
    [INTENTS.SUBSCRIPTION_UPDATE]: 0,
    [INTENTS.REMINDER_QUERY]: 0,
    [INTENTS.SUBSCRIPTION_QUERY]: 0,
    [INTENTS.SUBSCRIPTION_EXPIRY]: 0,
    [INTENTS.SUBSCRIPTION_CREATE]: 0,
    [INTENTS.UNKNOWN]: 0.35
  }

  if (/^(help|start|hi|hello|hi help|what can you do\??|commands|\?)$/i.test(text)) {
    scores[INTENTS.HELP] = 0.99
  }
  if (/^(more|show more|next)$/i.test(text)) {
    scores[INTENTS.LIST_MORE] = 0.99
  }
  if (/^(yes|confirm|ok|okay|k)$/i.test(text)) {
    scores[INTENTS.CONFIRM] = 0.99
  }
  if (/^(no|cancel|stop)$/i.test(text)) {
    scores[INTENTS.CANCEL] = 0.99
  }

  if (
    (/\b(?:cancel|delete|remove)\b/.test(lower) && /\b(?:reminder|reminders)\b/.test(lower)) ||
    /\bstop reminding me\b/.test(lower)
  ) {
    scores[INTENTS.REMINDER_CANCEL] = clamp(0.88 + deleteSemantic * 0.1)
  }
  if (
    deleteSemantic > 0.4 &&
    (subscriptionSemantic > 0.35 || /\bsubscription\b/.test(lower))
  ) {
    scores[INTENTS.SUBSCRIPTION_DELETE] = clamp(0.75 + deleteSemantic * 0.2)
  }
  if (/^remove\s+[a-z0-9+.\s-]+$/i.test(text)) {
    scores[INTENTS.SUBSCRIPTION_DELETE] = Math.max(scores[INTENTS.SUBSCRIPTION_DELETE], 0.94)
  }

  if (
    deleteSemantic > 0.4 &&
    !/\b(?:reminder|reminders|subscription)\b/.test(lower) &&
    !/^remove\s+/i.test(text) &&
    /^(?:delete|cancel)\s+[a-z0-9+.\s-]+$/i.test(text)
  ) {
    scores[INTENTS.DELETE_ENTITY] = clamp(0.8 + deleteSemantic * 0.15)
  }
  if (
    deleteSemantic > 0.55 &&
    !/\b(?:reminder|reminders|subscription)\b/.test(lower) &&
    !/^remove\s+/i.test(text) &&
    /^(?:d[e3]l[e3]te|cancel)\s+\S+/i.test(lower)
  ) {
    scores[INTENTS.DELETE_ENTITY] = Math.max(scores[INTENTS.DELETE_ENTITY], 0.88)
  }

  if (/\bremind\s+me\b/i.test(lower)) {
    scores[INTENTS.REMINDER_CREATE] = 0.95
    scores[INTENTS.REMINDER_QUERY] = Math.min(scores[INTENTS.REMINDER_QUERY], 0.45)
  } else if (
    (/\b(?:dont forget|do not forget|ping me|notify me|alert me)\b/.test(lower) ||
      /\b(?:create a reminder|set a reminder|add a reminder)\b/.test(lower)) &&
    (hasFutureSchedule(entities) || reminderSemantic > 0.55)
  ) {
    scores[INTENTS.REMINDER_CREATE] = clamp(0.72 + reminderSemantic * 0.25)
    scores[INTENTS.REMINDER_QUERY] = Math.min(scores[INTENTS.REMINDER_QUERY], 0.45)
  }
  if (/\bdont(?:\s+not)?\s+let\s+me\s+forget\b/i.test(lower) || /\bremind me later\b/i.test(lower)) {
    scores[INTENTS.REMINDER_CREATE] = 0.95
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.3
    scores[INTENTS.SUBSCRIPTION_CREATE] = 0.3
  }

  const looksLikeSubscriptionSetup =
    /\brenews?\s+(?:on|every)\b/i.test(lower) ||
    (/\b(?:monthly|yearly|every\s+(?:month|year|\d+\s+months?))\b/i.test(lower) &&
      (entities.amount ||
        /\b(?:\d{2,}|₹|rs\.?|inr)\b/i.test(text) ||
        (entities.serviceName && subscriptionSemantic > 0.25))) ||
    (entities.serviceName &&
      entities.recurrence &&
      (entities.amount || /\b\d{2,}\b/.test(text))) ||
    (/\btrack\b/i.test(lower) && /\brenewal\b/i.test(lower) && !/\bstop\s+tracking\b/i.test(lower))

  if (looksLikeSubscriptionSetup) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = Math.max(scores[INTENTS.SUBSCRIPTION_CREATE], 0.92)
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.42)
    scores[INTENTS.SUBSCRIPTION_EXPIRY] = Math.min(scores[INTENTS.SUBSCRIPTION_EXPIRY], 0.4)
  }

  if (
    hasFutureSchedule(entities) &&
    (actionSemantic > 0.3 || entities.actionText || paymentSemantic > 0.35) &&
    expirySemantic < 0.55 &&
    !looksLikeSubscriptionSetup &&
    reminderSemantic < 0.5 &&
    !/\b(?:ends?|expires?|runs out|valid till)\b/.test(lower)
  ) {
    const implicit = 0.62 + actionSemantic * 0.2 + (entities.actionText ? 0.12 : 0)
    scores[INTENTS.REMINDER_CREATE] = Math.max(scores[INTENTS.REMINDER_CREATE], clamp(implicit))
  }

  if (/\b(?:in|after)\s+\d+\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/i.test(lower)) {
    scores[INTENTS.REMINDER_CREATE] = Math.max(scores[INTENTS.REMINDER_CREATE], 0.88)
  }

  if (isReminderReschedulePhrase(lower, entities)) {
    scores[INTENTS.REMINDER_RESCHEDULE] = clamp(0.9 + updateSemantic * 0.08)
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.min(scores[INTENTS.SUBSCRIPTION_QUERY], 0.35)
  } else if (
    !/\bremind\s+me\b/.test(lower) &&
    updateSemantic > 0.35 &&
    (/\b(?:reminder|it)\b/.test(lower) ||
      /\b(?:am|pm|morning|afternoon|evening|tomorrow|today|sunday|monday|tuesday|wednesday|thursday|friday|saturday|next\s+(?:week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/.test(lower))
  ) {
    scores[INTENTS.REMINDER_RESCHEDULE] = clamp(0.65 + updateSemantic * 0.28)
  }

  const subscriptionSetupPhrase =
    /\b(?:monthly|yearly)\b/i.test(lower) &&
    entities.serviceName &&
    !/\b(?:update|change|edit|modify)\b/i.test(lower)

  if (
    /\b(?:delete|remove|cancel)\b/i.test(lower) &&
    /\bsubscription\b/i.test(lower) &&
    entities.serviceName
  ) {
    scores[INTENTS.SUBSCRIPTION_DELETE] = 0.97
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.3
    scores[INTENTS.DELETE_ENTITY] = 0.35
  }

  if (
    updateSemantic > 0.35 &&
    entities.serviceName &&
    /\b(?:amount|renewal|date|subscription)\b/.test(lower) &&
    !subscriptionSetupPhrase &&
    !(/\brenewal\b/i.test(lower) && /\btrack\b/i.test(lower)) &&
    deleteSemantic < 0.4
  ) {
    scores[INTENTS.SUBSCRIPTION_UPDATE] = clamp(0.88 + updateSemantic * 0.1)
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.45)
  } else if (updateSemantic > 0.35 && subscriptionSemantic > 0.2 && !subscriptionSetupPhrase) {
    scores[INTENTS.SUBSCRIPTION_UPDATE] = clamp(0.6 + updateSemantic * 0.3)
  }

  if (
    updateSemantic > 0.35 &&
    (entities.date?.time || /\b(?:am|pm|morning|afternoon|evening)\b/i.test(lower)) &&
    !entities.serviceName
  ) {
    scores[INTENTS.REMINDER_RESCHEDULE] = Math.max(scores[INTENTS.REMINDER_RESCHEDULE], 0.93)
  }

  if (/\b(?:show|list)\b/i.test(lower) && /\b(?:reminder|reminders)\b/i.test(lower)) {
    scores[INTENTS.REMINDER_QUERY] = 0.94
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.min(scores[INTENTS.SUBSCRIPTION_QUERY], 0.4)
  } else if (/\b(?:show|list)\b/i.test(lower) && /\b(?:subscription|subscriptions)\b/i.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.94
    scores[INTENTS.REMINDER_QUERY] = Math.min(scores[INTENTS.REMINDER_QUERY], 0.4)
  } else if (
    /\btell me about\b/i.test(lower) &&
    /\b(?:subscription|subscriptions|reminder|reminders)\b/i.test(lower)
  ) {
    scores[
      /\b(?:reminder|reminders)\b/i.test(lower)
        ? INTENTS.REMINDER_QUERY
        : INTENTS.SUBSCRIPTION_QUERY
    ] = 0.93
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.4)
  } else if (querySemantic > 0.35 && reminderSemantic > 0.25) {
    scores[INTENTS.REMINDER_QUERY] = clamp(0.55 + querySemantic * 0.35 + reminderSemantic * 0.15)
  }
  if (/\b(?:today|tomorrow|tomorrows|upcoming)\b/.test(lower) && /\b(?:reminder|reminders)\b/.test(lower)) {
    scores[INTENTS.REMINDER_QUERY] = Math.max(scores[INTENTS.REMINDER_QUERY], 0.92)
  }
  if (/\bwhat\s+(?:renews|is due)\s+tomorrow\b/.test(lower)) {
    scores[INTENTS.REMINDER_QUERY] = Math.max(scores[INTENTS.REMINDER_QUERY], 0.9)
  }

  if (/\bhow many\b/.test(lower) && subscriptionSemantic > 0.3) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.95
  }
  if (/\bwhat\s+renews?\s+next\b/.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.95
  }
  if (/\bwhat\s+renews?\s+this\s+month\b/.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.95
  }
  if (
    querySemantic > 0.35 &&
    subscriptionSemantic > 0.3 &&
    /\b(?:show|list|what|which|how many|tell me)\b/i.test(lower)
  ) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.max(scores[INTENTS.SUBSCRIPTION_QUERY], 0.9)
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.45)
  }

  if (
    /\b(?:ends?|expires?|expired|runs out|valid till|active till)\b/.test(lower) &&
    (entities.serviceName || subscriptionSemantic > 0.25) &&
    hasFutureSchedule(entities) &&
    !looksLikeSubscriptionSetup
  ) {
    scores[INTENTS.SUBSCRIPTION_EXPIRY] = clamp(
      0.72 + expirySemantic * 0.2 + (entities.serviceName ? 0.1 : 0)
    )
  }

  if (
    /^add\s+.+\s+subscription$/i.test(text) ||
    /\brenews?\s+(?:on|every)\b/i.test(text) ||
    (/\b(?:monthly|yearly|every\s+\d+\s+months?)\b/i.test(lower) && /\b(?:\d{2,}|₹|rs\.?|inr)\b/i.test(text)) ||
    looksLikeSubscriptionSetup
  ) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = Math.max(scores[INTENTS.SUBSCRIPTION_CREATE], 0.9)
  }
  if (/^[a-z0-9+.\s-]+\s+subscription$/i.test(text)) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = Math.max(scores[INTENTS.SUBSCRIPTION_CREATE], 0.75)
  }
  if (
    subscriptionSemantic > 0.35 &&
    /\b(?:monthly|yearly|every month)\b/i.test(lower) &&
    /\b\d{2,}\b/.test(lower) &&
    reminderSemantic < 0.4
  ) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = Math.max(scores[INTENTS.SUBSCRIPTION_CREATE], 0.72)
  }

  if (/^(?:delete|remove|cancel)$/i.test(text)) {
    scores[INTENTS.SUBSCRIPTION_DELETE] = 0.96
    scores[INTENTS.REMINDER_QUERY] = 0.2
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.2
  }
  if (/^change reminder$/i.test(text)) {
    scores[INTENTS.REMINDER_RESCHEDULE] = Math.max(scores[INTENTS.REMINDER_RESCHEDULE], 0.55)
  }

  if (/^change\s+to\b/i.test(lower) && entities.date) {
    scores[INTENTS.REMINDER_RESCHEDULE] = Math.max(scores[INTENTS.REMINDER_RESCHEDULE], 0.94)
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.min(scores[INTENTS.SUBSCRIPTION_QUERY], 0.4)
  }

  if (entities.actionText && hasFutureSchedule(entities) && !looksLikeSubscriptionSetup) {
    scores[INTENTS.REMINDER_CREATE] = Math.max(scores[INTENTS.REMINDER_CREATE], 0.9)
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.min(scores[INTENTS.SUBSCRIPTION_QUERY], 0.42)
  }

  if (
    hasFutureSchedule(entities) &&
    (/\b(?:appointment|meeting)\b/i.test(lower) ||
      entities.actionText ||
      actionSemantic > 0.45) &&
    !looksLikeSubscriptionSetup &&
    reminderSemantic < 0.5
  ) {
    scores[INTENTS.REMINDER_CREATE] = Math.max(scores[INTENTS.REMINDER_CREATE], 0.86)
  }

  if (/\b(?:ends?|expires?|runs out|valid till)\b/.test(lower) && entities.serviceName) {
    scores[INTENTS.SUBSCRIPTION_EXPIRY] = Math.max(scores[INTENTS.SUBSCRIPTION_EXPIRY], 0.85)
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.5)
  }

  if (
    /\b(?:renewal)\b/.test(lower) &&
    subscriptionSemantic > 0.3 &&
    reminderSemantic < 0.6 &&
    !/\bstop tracking\b/.test(lower)
  ) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = Math.max(scores[INTENTS.SUBSCRIPTION_CREATE], 0.8)
  }

  if (scores[INTENTS.REMINDER_CREATE] >= 0.7) {
    scores[INTENTS.REMINDER_QUERY] = Math.min(scores[INTENTS.REMINDER_QUERY], 0.44)
  }

  if (
    /\b(?:cancel|delete|remove)\b/.test(lower) &&
    /\b(?:reminder|reminders)\b/.test(lower)
  ) {
    scores[INTENTS.REMINDER_CANCEL] = 0.97
    scores[INTENTS.REMINDER_QUERY] = 0.3
    scores[INTENTS.REMINDER_CREATE] = 0.3
  }

  if (/^(?:delete|cancel|remove)\s+(?:everything|all)\b/i.test(lower)) {
    for (const key of Object.keys(scores)) {
      if (key !== INTENTS.UNKNOWN) {
        scores[key] = 0.2
      }
    }
    scores[INTENTS.UNKNOWN] = 0.35
  }

  if (/\bstop tracking\b/.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_DELETE] = 0.97
    scores[INTENTS.REMINDER_CREATE] = 0.3
    scores[INTENTS.SUBSCRIPTION_CREATE] = 0.3
    scores[INTENTS.SUBSCRIPTION_EXPIRY] = 0.3
  }

  if (
    /\b(?:reminder|reminders)\b/i.test(lower) &&
    /\b(?:today|tomorrow|tomorrows|upcoming)\b/i.test(lower) &&
    !/\bremind\s+me\b/i.test(lower)
  ) {
    scores[INTENTS.REMINDER_QUERY] = 0.94
    scores[INTENTS.REMINDER_CREATE] = Math.min(scores[INTENTS.REMINDER_CREATE], 0.42)
  }

  if (
    /\b(?:subscription|subscriptions)\b/i.test(lower) &&
    /\b(?:today|tomorrow)\b/i.test(lower) &&
    !/\bremind\b/i.test(lower)
  ) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = Math.max(scores[INTENTS.SUBSCRIPTION_QUERY], 0.9)
  }

  if (/\bhow many\b/i.test(lower) && /\b(?:subscription|subscriptions)\b/i.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.96
    scores[INTENTS.REMINDER_QUERY] = 0.32
  }

  if (/\bwhat\s+renews?\s+next\b/i.test(lower) || /\bwhat\s+renews?\s+this\s+month\b/i.test(lower)) {
    scores[INTENTS.SUBSCRIPTION_QUERY] = 0.96
    scores[INTENTS.REMINDER_QUERY] = 0.32
  }

  if (
    /\b(?:update|change)\b/i.test(lower) &&
    entities.serviceName &&
    (entities.amount || /\bamount\b/i.test(lower))
  ) {
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.93
  }

  if (
    /\b(?:must|need to)\s+(?:pay|call|buy|visit)\b/i.test(lower) &&
    hasFutureSchedule(entities)
  ) {
    scores[INTENTS.REMINDER_CREATE] = 0.9
    scores[INTENTS.SUBSCRIPTION_DELETE] = 0.3
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.3
  }

  if (
    /\b(?:monthly|yearly)\b/i.test(lower) &&
    entities.serviceName &&
    (entities.amount || /\b\d{2,}\b/.test(text))
  ) {
    scores[INTENTS.SUBSCRIPTION_CREATE] = 0.92
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.3
  }

  if (/\bwhat\s+(?:renews|is due)\s+tomorrow\b/i.test(lower)) {
    scores[INTENTS.REMINDER_QUERY] = 0.94
    scores[INTENTS.REMINDER_CREATE] = 0.32
  }

  if (
    /\brenewal\b/i.test(lower) &&
    /\b(?:today|tomorrow)\b/i.test(lower) &&
    !/\b(?:update|change|amount|remind)\b/i.test(lower)
  ) {
    scores[INTENTS.REMINDER_QUERY] = 0.94
    scores[INTENTS.REMINDER_CREATE] = 0.3
    scores[INTENTS.SUBSCRIPTION_UPDATE] = 0.3
  }

  return scores
}

function resolveQueryType(text, lower, intent) {
  if (intent !== INTENTS.SUBSCRIPTION_QUERY && intent !== INTENTS.SUBSCRIPTION_EXPIRY) {
    return {}
  }
  if (/\bhow many\b/.test(lower) && /\b(?:subscription|subscriptions)\b/.test(lower)) {
    return { queryType: 'count' }
  }
  if (/\bwhat\s+renews?\s+next\b/.test(lower)) {
    return { queryType: 'renews_next' }
  }
  if (/\bwhat\s+renews?\s+this\s+month\b/.test(lower)) {
    return { queryType: 'renews_month' }
  }
  if (intent === INTENTS.SUBSCRIPTION_EXPIRY) {
    return { queryType: 'expiry' }
  }
  return {}
}

function pickBestIntent(scores) {
  const strong = Object.entries(scores).filter(
    ([intent, score]) => intent !== INTENTS.UNKNOWN && score >= MIN_CONFIDENCE
  )

  if (!strong.length) {
    return { intent: INTENTS.UNKNOWN, confidence: 0.35 }
  }

  let bestIntent = INTENTS.UNKNOWN
  let bestScore = 0

  for (const [intent, score] of strong) {
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  return { intent: bestIntent, confidence: clamp(bestScore) }
}

function buildResult(intent, confidence, text, entities, extra = {}) {
  return {
    intent,
    confidence,
    rawText: text,
    entities: {
      ...(entities.serviceName ? { serviceName: entities.serviceName } : {}),
      ...(entities.amount ? { amount: entities.amount } : {}),
      ...(entities.date ? { date: entities.date } : {}),
      ...(entities.recurrence ? { recurrence: entities.recurrence } : {}),
      ...(entities.actionText ? { actionText: entities.actionText } : {}),
      ...extra
    }
  }
}

function detectIntent(message) {
  const text = normalizeText(applyTypoFixes(message))
  const lower = normalizeForIntentMatch(text)

  if (!text) {
    return buildResult(INTENTS.UNKNOWN, 0, text, {})
  }

  const entities = extractEntities(text)
  const threshold = DEFAULT_FUZZY_THRESHOLD
  const scores = scoreSignals(text, lower, entities, threshold)
  const { intent, confidence } = pickBestIntent(scores)
  const routedIntent =
    intent === INTENTS.SUBSCRIPTION_EXPIRY ? INTENTS.SUBSCRIPTION_QUERY : intent
  const extra = resolveQueryType(text, lower, intent)

  return buildResult(routedIntent, confidence, text, entities, extra)
}

function mergeDateEntities(base, patch) {
  if (!patch) {
    return base || null
  }
  if (!base) {
    return patch
  }

  return {
    ...base,
    ...patch,
    time: patch.time || base.time,
    period: patch.period || base.period
  }
}

function needsExplicitTimePrompt(entities = {}, text = '') {
  if (extractOffset(text)) {
    return false
  }
  const date = entities.date
  if (!date) {
    return true
  }
  if (date.kind === 'offset' || date.kind === 'time_only') {
    return false
  }
  if (date.time?.source === 'explicit') {
    return false
  }
  if (date.period) {
    return false
  }
  if (date.kind === 'relative' && (date.value === 'today' || date.value === 'tomorrow')) {
    return true
  }
  return false
}

module.exports = {
  INTENTS,
  detectIntent,
  mergeDateEntities,
  needsExplicitTimePrompt,
  extractOffset,
  scoreSignals,
  pickBestIntent,
  MIN_CONFIDENCE
}
