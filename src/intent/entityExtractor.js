const { extractServiceCandidate, registerService } = require('./serviceCatalog')

const MONTH_PATTERN =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY_PATTERN =
  '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)'

function titleCase(value) {
  return String(value)
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
    .replace(/\b(?:subscription|reminder|renewal|existing|about|for|please|pls|my|the|a|an|to|on|tomorrow|today|track|monitor)\b/gi, ' ')
    .replace(/\b(?:cancel|delete|remove|stop|tracking|reminding|change|update|edit|modify|make|set|move|reschedule|it|time)\b/gi, ' ')
    .replace(/\b(?:morning|afternoon|evening|at|next|week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ')
    .replace(/\b(?:what|which|show|list|tell|me|do|i|have|renews?|ends?|expires?)\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ')
    .replace(/[^a-z0-9+.\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || /^\d+$/.test(cleaned)) {
    return null
  }

  return titleCase(cleaned)
}

function extractAmount(text) {
  const currencyMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d{2,})\b/i)
  if (currencyMatch) {
    return Number(currencyMatch[1])
  }

  const amountToMatch = text.match(/(?:amount\s+to|to)\s+(\d{2,})\b/i)
  if (amountToMatch) {
    return Number(amountToMatch[1])
  }

  const priceSuffixMatch = text.match(/-\s*(\d{2,})\b/)
  if (priceSuffixMatch) {
    return Number(priceSuffixMatch[1])
  }

  return null
}

function extractRecurrence(text) {
  const lower = text.toLowerCase()
  if (/\brenews?\s+(?:on\s+)?\d{1,2}(?:st|nd|rd|th)?\b/i.test(lower)) {
    return 'monthly'
  }
  if (/\b(?:monthly|every\s+month|per\s+month)\b/.test(lower)) {
    return 'monthly'
  }
  if (/\b(?:yearly|every\s+year|annually)\b/.test(lower)) {
    return 'yearly'
  }
  if (/\bevery\s+(\d+)\s+months?\b/.test(lower)) {
    return lower.match(/\bevery\s+(\d+)\s+months?\b/)[0]
  }
  if (/\b(?:daily|every\s+day)\b/.test(lower)) {
    return 'daily'
  }
  if (/\bevery\s+weekday\b/.test(lower)) {
    return 'weekdays'
  }
  if (/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) {
    return lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)[1]
  }
  if (/\bevery\s+(\d{1,2})(?:st|nd|rd|th)?\b/.test(lower)) {
    return lower.match(/\bevery\s+(\d{1,2})(?:st|nd|rd|th)?\b/)[0]
  }
  if (new RegExp(`\\bevery\\s+${MONTH_PATTERN}\\s+(\\d{1,2})\\b`, 'i').test(text)) {
    return 'yearly'
  }
  return null
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

  const bareMeridiem = text.match(/\b(\d{1,2})\s*(am|pm)\b/i)
  if (bareMeridiem) {
    let hour = Number(bareMeridiem[1])
    const meridiem = bareMeridiem[2].toLowerCase()
    if (meridiem === 'pm' && hour < 12) {
      hour += 12
    }
    if (meridiem === 'am' && hour === 12) {
      hour = 0
    }
    return { hour, minute: 0, source: 'explicit' }
  }

  const trailingHour = text.match(/\b(\d{1,2})\s*$/i)
  if (trailingHour && Number(trailingHour[1]) <= 23) {
    return {
      hour: Number(trailingHour[1]),
      minute: 0,
      source: 'explicit'
    }
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
  if (/\bevening\b/.test(lower) || /\btonight\b/.test(lower)) {
    return 'evening'
  }

  return null
}

function extractOffset(text) {
  if (/\bafter\s+an\s+hour\b/i.test(text)) {
    return { kind: 'offset', minutes: 60 }
  }

  const match = text.match(
    /\b(?:in|after)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i
  )
  if (!match) {
    const laterMatch = text.match(
      /\b(\d+)\s*(minutes?|mins?|hours?|hrs?)\s+later\b/i
    )
    if (laterMatch) {
      const amount = Number(laterMatch[1])
      const unit = laterMatch[2].toLowerCase()
      if (/hour|hr/.test(unit)) {
        return { kind: 'offset', minutes: amount * 60 }
      }
      return { kind: 'offset', minutes: amount }
    }
    return null
  }

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  if (/day/.test(unit)) {
    return { kind: 'offset', minutes: amount * 24 * 60 }
  }
  if (/hour|hr/.test(unit)) {
    return { kind: 'offset', minutes: amount * 60 }
  }
  return { kind: 'offset', minutes: amount }
}

function extractDate(text) {
  const lower = text.toLowerCase()
  const offset = extractOffset(text)
  if (offset) {
    return offset
  }

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

  if (/\btonight\b/.test(lower)) {
    return {
      kind: 'relative',
      value: 'today',
      period: 'evening',
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

  const monthDay = text.match(
    new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i')
  )
  const dayMonth = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}\\b`, 'i')
  )
  const validTill = text.match(
    new RegExp(`\\bvalid till\\s+${MONTH_PATTERN}\\s+(\\d{1,2})\\b`, 'i')
  )

  if (validTill) {
    return {
      kind: 'month_day',
      month: validTill[1],
      day: Number(validTill[2]),
      ...(time ? { time } : {})
    }
  }

  if (monthDay) {
    return {
      kind: 'month_day',
      month: monthDay[1],
      day: Number(monthDay[2]),
      ...(time ? { time } : {})
    }
  }

  if (dayMonth) {
    return {
      kind: 'month_day',
      month: dayMonth[2],
      day: Number(dayMonth[1]),
      ...(time ? { time } : {})
    }
  }

  const dayOnly = text.match(/\b(?:on|date|the)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)

  if (dayOnly) {
    return {
      kind: 'day',
      day: Number(dayOnly[1]),
      ...(time ? { time } : {})
    }
  }

  if (/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i.test(text)) {
    const onDay = text.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i)
    return {
      kind: 'day',
      day: Number(onDay[1]),
      ...(time ? { time } : {})
    }
  }

  const trailingDay = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*$/i)
  if (trailingDay) {
    return {
      kind: 'day',
      day: Number(trailingDay[1]),
      ...(time ? { time } : {})
    }
  }

  if (/\bafter\s+lunch\b/i.test(lower)) {
    return { kind: 'relative', value: 'today', period: 'afternoon', ...(time ? { time } : {}) }
  }
  if (/\bafter\s+dinner\b/i.test(lower)) {
    return { kind: 'relative', value: 'today', period: 'evening', ...(time ? { time } : {}) }
  }
  if (/\bbefore\s+sleeping\b/i.test(lower)) {
    return { kind: 'relative', value: 'today', period: 'evening', ...(time ? { time } : {}) }
  }

  if (time) {
    return {
      kind: 'time_only',
      time
    }
  }

  return null
}

function extractServiceName(text) {
  if (/^(?:delete|remove|cancel)$/i.test(text.trim())) {
    return null
  }

  if (/\bremind\s+me\s+to\b/i.test(text)) {
    const catalog = extractServiceCandidate(text)
    return catalog || null
  }

  if (/\b(?:ping|notify|alert|wake)\s+me\b/i.test(text)) {
    return null
  }

  const patterns = [
    /\b(?:about|for)\s+([a-z0-9+.\s-]+?)\s+(?:subscription|reminder|renewal)\b/i,
    /\b(?:change|update|edit|modify)\s+([a-z0-9+.\s-]+?)\s+(?:amount|renewal|date|subscription)\b/i,
    /\b(?:update|change)\s+([a-z0-9+.\s-]+?)\s+to\b/i,
    /\b(?:cancel|delete|remove)\s+(?:my\s+)?([a-z0-9+.\s-]+?)\s+(?:reminder|subscription)\b/i,
    /\bstop\s+(?:tracking|reminding me about)\s+([a-z0-9+.\s-]+)/i,
    /^remove\s+([a-z0-9+.\s-]+)$/i,
    /^(?:delete|cancel|remove)\s+([a-z0-9+.\s-]+)$/i,
    /\b(?:remind me(?:\s+tomorrow)?\s+(?:about|to)?|create a reminder for|set a reminder for)\s+([a-z0-9+.\s-]+)/i,
    /^([a-z0-9+.\s-]+)\s+renews?\s+on\b/i,
    /^add\s+([a-z0-9+.\s-]+?)(?:\s+subscription)?$/i,
    /^(?:subscription|sub)\s+([a-z0-9+.\s-]+?)\s+(?:monthly|yearly|every\s+\d+\s+months?)\b/i,
    /^([a-z0-9+.\s-]+?)\s+(?:monthly|yearly|every\s+\d+\s+months?)\b/i,
    /\btrack\s+([a-z0-9+.\s-]+?)\s+renewal\b/i,
    /\bevery\s+\d{1,2}(?:st|nd|rd|th)?\s+renew\s+([a-z0-9+.\s-]+)\b/i,
    /\brenew\s+([a-z0-9+.\s-]+)\s*$/i,
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

    if (serviceName && !BLOCKED_SERVICE_NAMES.has(serviceName.toLowerCase())) {
      registerService(serviceName)
      return serviceName
    }
  }

  const catalog = extractServiceCandidate(text)
  if (catalog) {
    registerService(catalog)
    return catalog
  }

  return null
}

const BLOCKED_SERVICE_NAMES = new Set([
  'need', 'must', 'should', 'call', 'pay', 'buy', 'doctor', 'appointment', 'me', 'my',
  'remind me to', 'remind me', 'driving licence', 'driving license', 'before', 'after'
])

function extractActionText(text) {
  const patterns = [
    /\b(?:need to|must|should|have to)\s+(.+?)(?:\s+(?:tomorrow|today|tonight|on|at|in|after|next|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b|$)/i,
    /\b(?:remind\s+me\s+(?:to|about))\s+(.+?)(?:\s+(?:tomorrow|today|at|on|in|after)\b|$)/i,
    /\b([a-z].+?)\s+(?:tomorrow|today|tonight)\b/i,
    /^(?:mom|milk|doctor|gym|emi|rent)\s+(?:tomorrow|today|tonight|friday|monday|tuesday|wednesday|thursday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?)\b/i,
    /\b((?:doctor|dentist)\s+)?appointment\s+([a-z]+day)\b/i,
    /\b(?:appointment|meeting)\s+(?:for\s+)?(.+?)(?:\s+on\b|$)/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const captured = match?.[2] || match?.[1]
    if (captured) {
      const action = cleanEntity(
        pattern.source.includes('appointment') && match[1] && !match[2]
          ? `${match[1] || ''} appointment`.trim()
          : captured
      )
      if (action && action.length > 2) {
        return action
      }
    }
  }

  return null
}

function extractEntities(text) {
  const serviceName = extractServiceName(text)
  const date = extractDate(text)
  const amount = extractAmount(text)
  const recurrence = extractRecurrence(text)
  const actionText = extractActionText(text)

  return {
    serviceName,
    date,
    amount,
    recurrence,
    actionText
  }
}

module.exports = {
  extractEntities,
  extractServiceName,
  extractDate,
  extractAmount,
  extractRecurrence,
  extractActionText,
  extractOffset,
  cleanEntity,
  titleCase
}
