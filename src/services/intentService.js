const { normalizeText, normalizeForIntentMatch } = require('../utils/textUtils')

const INTENTS = {
  SUBSCRIPTION_CREATE: 'SUBSCRIPTION_CREATE',
  SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATE',
  SUBSCRIPTION_DELETE: 'SUBSCRIPTION_DELETE',
  SUBSCRIPTION_QUERY: 'SUBSCRIPTION_QUERY',
  REMINDER_CREATE: 'REMINDER_CREATE',
  REMINDER_UPDATE: 'REMINDER_UPDATE',
  REMINDER_RESCHEDULE: 'REMINDER_RESCHEDULE',
  REMINDER_CANCEL: 'REMINDER_CANCEL',
  REMINDER_QUERY: 'REMINDER_QUERY',
  HELP: 'HELP',
  LIST_MORE: 'LIST_MORE',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  UNKNOWN: 'UNKNOWN'
}

const MONTH_PATTERN =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY_PATTERN =
  '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)'

function isReminderQueryText(text) {
  return (
    /\b(?:what|which|show|list|tell me|do i have|existing|my)\b/.test(text) &&
      /\b(?:reminder|reminders|renews?|renewal|renewals|due)\b/.test(text)
  ) ||
    /\b(?:tomorrow|tomorrows|upcoming)\b.*\b(?:reminder|reminders|renewal|renewals|subscription|subscriptions)\b/.test(text) ||
    /\b(?:reminder|reminders|renewal|renewals|subscription|subscriptions)\b.*\b(?:tomorrow|tomorrows|upcoming)\b/.test(text) ||
    /\bwhat\s+(?:renews|is due)\s+tomorrow\b/.test(text)
}

function isReminderUpdateText(text) {
  if (/\bremind\s+me\b/.test(text)) {
    return false
  }

  return /\b(?:change|make|set|move|update|reschedule)\b/.test(text) &&
    (
      /\b(?:reminder|it)\b/.test(text) ||
      /\b(?:am|pm|morning|afternoon|evening|tomorrow|today|sunday|monday|tuesday|wednesday|thursday|friday|saturday|next\s+(?:week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/.test(text)
    )
}

function isReminderCancelText(text) {
  return (
    /\b(?:cancel|delete|remove)\b/.test(text) &&
      /\b(?:reminder|reminders)\b/.test(text)
  ) ||
    /\bstop reminding me\b/.test(text)
}

function isSubscriptionDeleteText(text) {
  return (
    /\b(?:delete|cancel|remove)\b/.test(text) &&
      /\bsubscription\b/.test(text)
  ) ||
    /\bstop tracking\b/.test(text) ||
    /^remove\s+[a-z0-9+.\s-]+$/.test(text)
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function cleanEntity(value) {
  if (!value) {
    return null
  }

  const cleaned = String(value)
    .replace(/\b(?:subscription|reminder|renewal|existing|about|for|please|my|the|a|an|to|on|tomorrow|today)\b/gi, ' ')
    .replace(/\b(?:cancel|delete|remove|stop|tracking|reminding|change|update|edit|modify|make|set|move|reschedule|it|time)\b/gi, ' ')
    .replace(/\b(?:morning|afternoon|evening|at|next|week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ')
    .replace(/\b(?:what|which|show|list|tell|me|do|i|have|renews?)\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ')
    .replace(/[^a-z0-9+.\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || /^\d+$/.test(cleaned)) {
    return null
  }

  return titleCase(cleaned)
}

function extractServiceName(text) {
  const patterns = [
    /\b(?:about|for)\s+([a-z0-9+.\s-]+?)\s+(?:subscription|reminder|renewal)\b/i,
    /\b(?:change|update|edit|modify)\s+([a-z0-9+.\s-]+?)\s+(?:amount|renewal|date|subscription)\b/i,
    /\b(?:cancel|delete|remove)\s+(?:my\s+)?([a-z0-9+.\s-]+?)\s+(?:reminder|subscription)\b/i,
    /\bstop\s+(?:tracking|reminding me about)\s+([a-z0-9+.\s-]+)/i,
    /^remove\s+([a-z0-9+.\s-]+)$/i,
    /\b(?:remind me(?:\s+tomorrow)?\s+(?:about|to)?|create a reminder for|set a reminder for)\s+([a-z0-9+.\s-]+)/i,
    /^([a-z0-9+.\s-]+?)\s+renews?\b/i,
    /^add\s+([a-z0-9+.\s-]+?)(?:\s+subscription)?$/i,
    /^([a-z0-9+.\s-]+?)\s+(?:monthly|yearly|every\s+\d+\s+months?)\b/i,
    /^([a-z0-9+.\s-]+?)\s+renewal\b/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (
      pattern.source.includes('remind me') &&
      /\bremind\s+me\s+to\b/i.test(text)
    ) {
      continue
    }

    const serviceName = cleanEntity(match?.[1])

    if (serviceName) {
      return serviceName
    }
  }

  return null
}

function extractAmount(text) {
  const amountMatch = text.match(/(?:amount\s+to|to|₹|rs\.?|inr)?\s*(\d{2,})\b/i)
  return amountMatch ? Number(amountMatch[1]) : null
}

function extractTime(text) {
  const meridiemMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)

  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2] || 0)
    const meridiem = meridiemMatch[3].toLowerCase()

    if (meridiem === 'pm' && hour < 12) {
      hour += 12
    }
    if (meridiem === 'am' && hour === 12) {
      hour = 0
    }

    return { hour, minute, source: 'explicit' }
  }

  const hourOnlyMatch = text.match(/\bat\s+(\d{1,2})(?!\d|:)/i)

  if (hourOnlyMatch) {
    return {
      hour: Number(hourOnlyMatch[1]),
      minute: 0,
      source: 'explicit'
    }
  }

  return null
}

function extractPeriod(text) {
  const lower = text.toLowerCase()

  if (/\bmorning\b/.test(lower)) {
    return 'morning'
  }
  if (/\bafternoon\b/.test(lower)) {
    return 'afternoon'
  }
  if (/\bevening\b/.test(lower)) {
    return 'evening'
  }

  return null
}

function extractDate(text) {
  const lower = text.toLowerCase()
  const time = extractTime(text)
  const period = extractPeriod(text)

  if (/\btomorrow\b/.test(lower)) {
    return {
      kind: 'relative',
      value: 'tomorrow',
      ...(period ? { period } : {}),
      ...(time ? { time } : {})
    }
  }

  if (/\btoday\b/.test(lower)) {
    return {
      kind: 'relative',
      value: 'today',
      ...(period ? { period } : {}),
      ...(time ? { time } : {})
    }
  }

  if (/\bnext week\b/.test(lower)) {
    return {
      kind: 'relative',
      value: 'next_week',
      ...(time ? { time } : {})
    }
  }

  if (/\bnext month\b/.test(lower)) {
    return {
      kind: 'relative',
      value: 'next_month',
      ...(time ? { time } : {})
    }
  }

  const nextWeekday = text.match(new RegExp(`\\bnext\\s+${WEEKDAY_PATTERN}\\b`, 'i'))

  if (nextWeekday) {
    return {
      kind: 'weekday',
      value: nextWeekday[1].toLowerCase(),
      ...(time ? { time } : {})
    }
  }

  const weekday = text.match(new RegExp(`\\b${WEEKDAY_PATTERN}\\b`, 'i'))

  if (weekday) {
    return {
      kind: 'weekday',
      value: weekday[1].toLowerCase(),
      ...(time ? { time } : {})
    }
  }

  const monthDay = text.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))

  if (monthDay) {
    return {
      kind: 'month_day',
      month: monthDay[1],
      day: Number(monthDay[2]),
      ...(time ? { time } : {})
    }
  }

  const dayOnly = text.match(/\b(?:on|date)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i)

  if (dayOnly) {
    return {
      kind: 'day',
      day: Number(dayOnly[1]),
      ...(time ? { time } : {})
    }
  }

  if (time) {
    return {
      kind: 'time_only',
      time
    }
  }

  return null
}

function buildResult(intent, confidence, text, extraEntities = {}) {
  const serviceName = extractServiceName(text)
  const date = extractDate(text)
  const amount = extractAmount(text)

  return {
    intent,
    confidence,
    entities: {
      ...(serviceName ? { serviceName } : {}),
      ...(amount ? { amount } : {}),
      ...(date ? { date } : {}),
      ...extraEntities
    }
  }
}

function detectIntent(message) {
  const text = normalizeText(message)
  const lower = normalizeForIntentMatch(text)

  if (!text) {
    return buildResult(INTENTS.UNKNOWN, 0, text)
  }

  if (/^(help|start|hi|hello|hi help|what can you do\??|commands|\?)$/i.test(text)) {
    return buildResult(INTENTS.HELP, 0.99, text)
  }

  if (/^(more|show more|next)$/i.test(text)) {
    return buildResult(INTENTS.LIST_MORE, 0.99, text)
  }

  if (/^(yes|confirm|ok|okay|k)$/i.test(text)) {
    return buildResult(INTENTS.CONFIRM, 0.99, text)
  }

  if (/^(no|cancel|stop)$/i.test(text)) {
    return buildResult(INTENTS.CANCEL, 0.99, text)
  }

  if (isReminderCancelText(lower)) {
    return buildResult(INTENTS.REMINDER_CANCEL, 0.94, text)
  }

  if (isSubscriptionDeleteText(lower)) {
    return buildResult(INTENTS.SUBSCRIPTION_DELETE, 0.94, text)
  }

  if (/\b(?:remind me|create a reminder|set a reminder|add a reminder)\b/.test(lower)) {
    return buildResult(INTENTS.REMINDER_CREATE, 0.93, text)
  }

  if (isReminderUpdateText(lower)) {
    return buildResult(INTENTS.REMINDER_RESCHEDULE, 0.93, text)
  }

  if (/\b(?:change|update|edit|modify)\b/.test(lower)) {
    return buildResult(INTENTS.SUBSCRIPTION_UPDATE, 0.9, text)
  }

  if (isReminderQueryText(lower)) {
    return buildResult(INTENTS.REMINDER_QUERY, 0.94, text)
  }

  if (
    /\b(?:renewal|renews?|due)\b/.test(lower) &&
    /\b(?:today|tomorrow|this week|next week)\b/.test(lower) &&
    !/\b(?:remind me|create|add|set)\b/.test(lower)
  ) {
    return buildResult(INTENTS.REMINDER_QUERY, 0.92, text)
  }

  if (
    /\b(?:show|list|tell me|what are|my)\b/.test(lower) &&
    /\b(?:subscription|subscriptions)\b/.test(lower)
  ) {
    return buildResult(INTENTS.SUBSCRIPTION_QUERY, 0.92, text)
  }

  if (
    /^add\s+.+\s+subscription$/i.test(text) ||
    /\brenews?\s+(?:on|every)\b/i.test(text) ||
    /\b(?:monthly|yearly|every\s+\d+\s+months?)\b/i.test(text) && /\b(?:\d{2,}|₹|rs\.?|inr)\b/i.test(text)
  ) {
    return buildResult(INTENTS.SUBSCRIPTION_CREATE, 0.9, text)
  }

  if (/^[a-z0-9+.\s-]+\s+subscription$/i.test(text)) {
    return buildResult(INTENTS.SUBSCRIPTION_CREATE, 0.75, text)
  }

  return buildResult(INTENTS.UNKNOWN, 0.35, text)
}

module.exports = {
  INTENTS,
  detectIntent
}
