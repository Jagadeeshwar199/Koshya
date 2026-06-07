const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

const AMOUNT = '(?:₹|rs\\.?|inr\\s*)?(\\d+)'

function applyTypoFixes(text) {
  return String(text)
    .replace(/\brenewls\b|\brenewes\b|\brenws\b|\brnews\b/gi, 'renews')
    .replace(/\bsubscritpion\b|\bsubscriuption\b/gi, 'subscription')
    .replace(/\bremiander\b/gi, 'reminder')
    .replace(/\btomorw\b|\btmrw\b/gi, 'tomorrow')
}

function normalizeText(text) {
  return applyTypoFixes(String(text)
    .trim()
    .replace(/[\u2013\u2014\u2212–—]/g, '-')
    .replace(/,/g, ' ')
    .replace(/=/g, ' ')
    .replace(/(\D)-(\d)/g, '$1 - $2')
    .replace(/(\d)-(\D)/g, '$1 - $2')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/:(?=\s*\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

function cleanServiceName(name) {
  const cleaned = name
    .replace(/[:;,.=\-]+$/g, '')
    .replace(/^(?:my|the|a|an)\s+/i, '')
    .replace(/\s+subscription$/i, '')
    .replace(/\s+(?:is|are)$/i, '')
    .replace(/\s+costs?$/i, '')
    .replace(/\s+recharge$/i, '')
    .replace(/\s+renews?$/i, '')
    .replace(/\s+and$/i, '')
    .trim()

  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function subscriptionResult(fields) {
  const recurrence = fields.recurrence
  return {
    success: true,
    type: 'subscription',
    serviceName: cleanServiceName(fields.serviceName),
    renewalDay: fields.renewalDay ?? null,
    renewalMonth: recurrence === 'monthly' ? null : fields.renewalMonth ?? null,
    recurrence,
    amount: fields.amount
  }
}

function tryPatterns(text) {
  const patterns = [
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\s+(monthly|yearly)(?:\\s*-?\\s*${AMOUNT})?\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalDay: Number(m[2]),
        renewalMonth: m[4].toLowerCase() === 'yearly' ? m[3] : null,
        recurrence: m[4].toLowerCase(),
        amount: m[5] ? Number(m[5]) : null
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2})(?:st|nd|rd|th)? every month(?:\\s*-)?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalDay: Number(m[2]),
        recurrence: 'monthly',
        amount: Number(m[3])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every (\\d+) months?\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: `${m[4]} months`,
        amount: Number(m[5])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2}) (${MONTH_PATTERN}) every (\\d+) months?\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalDay: Number(m[2]),
        renewalMonth: m[3],
        recurrence: `${m[4]} months`,
        amount: Number(m[5])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every year\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: 'yearly',
        amount: Number(m[4])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every month\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: 'monthly',
        amount: Number(m[4])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews (${MONTH_PATTERN}) (\\d{1,2}) every year\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: 'yearly',
        amount: Number(m[4])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews every (\\d+) months? on (${MONTH_PATTERN}) (\\d{1,2}) for ${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        recurrence: `${m[2]} months`,
        renewalMonth: m[3],
        renewalDay: Number(m[4]),
        amount: Number(m[5])
      })
    },
    {
      regex: new RegExp(
        `^my (.+?) subscription is ${AMOUNT} every month on the (\\d{1,2})(?:st|nd|rd|th)?\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        renewalDay: Number(m[3]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^i pay ${AMOUNT} for (.+?) every month\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[2],
        amount: Number(m[1]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) costs ${AMOUNT} yearly and renews on (${MONTH_PATTERN}) (\\d{1,2})\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        renewalMonth: m[3],
        renewalDay: Number(m[4]),
        recurrence: 'yearly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) is ${AMOUNT} monthly\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) ${AMOUNT} monthly\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) ${AMOUNT} yearly\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'yearly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) yearly ${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'yearly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) recharge ${AMOUNT} every month\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews monthly ${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'monthly'
      })
    },
    {
      regex: new RegExp(
        `^(.+?) every (\\d+) months?\\s*-?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        recurrence: `${m[2]} months`,
        amount: Number(m[3])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) yearly\\s*-\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        recurrence: 'yearly',
        amount: Number(m[2])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2})(?:st|nd|rd|th)? every month(?:\\s+for)?\\s*${AMOUNT}\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        renewalDay: Number(m[2]),
        recurrence: 'monthly',
        amount: Number(m[3])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) ${AMOUNT} monthly on (\\d{1,2})(?:st|nd|rd|th)?\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1],
        amount: Number(m[2]),
        recurrence: 'monthly',
        renewalDay: Number(m[3])
      })
    }
  ]

  for (const { regex, map } of patterns) {
    const match = text.match(regex)
    if (match) {
      return subscriptionResult(map(match))
    }
  }

  return null
}

function extractRecurrence(text) {
  const lower = text.toLowerCase()
  const everyMonths = lower.match(/every\s+(\d+)\s+months?/)

  if (everyMonths) {
    return `${everyMonths[1]} months`
  }

  if (/quarterly/.test(lower)) {
    return '3 months'
  }

  if (/yearly|annually|every\s+year/.test(lower)) {
    return 'yearly'
  }

  if (/monthly|every\s+month|per\s+month|\/mo\b/.test(lower)) {
    return 'monthly'
  }

  return null
}

function numberUsedAsRenewalDate(text, n) {
  const d = String(n)
  if (new RegExp(`\\b${d}\\s*(?:st|nd|rd|th)\\b`, 'i').test(text)) {
    return true
  }
  if (new RegExp(`\\b${d}\\s+(?:st|nd|rd|th)\\b`, 'i').test(text)) {
    return true
  }
  if (new RegExp(`\\b(?:on|the)\\s+${d}(?:st|nd|rd|th)?\\b`, 'i').test(text)) {
    return true
  }
  if (
    new RegExp(`\\b${d}\\s*(?:st|nd|rd|th)?\\s*(${MONTH_PATTERN})\\b`, 'i').test(
      text
    )
  ) {
    return true
  }
  if (new RegExp(`\\b(${MONTH_PATTERN})\\s+${d}\\b`, 'i').test(text)) {
    return true
  }
  if (new RegExp(`\\b${d}(?:st|nd|rd|th)?\\s+every\\s+month`, 'i').test(text)) {
    return true
  }
  return false
}

function extractAmount(text, renewalDay) {
  const currency = text.match(/(?:₹|rs\.?|inr\s*)(\d+)/i)
  if (currency) {
    return Number(currency[1])
  }

  const dashAmount = text.match(/-\s*(\d{2,})\b/)
  if (dashAmount) {
    return Number(dashAmount[1])
  }

  const monthlyAmount = text.match(/\b(\d{2,})\s+monthly\b/i)
  if (
    monthlyAmount &&
    !numberUsedAsRenewalDate(text, Number(monthlyAmount[1]))
  ) {
    return Number(monthlyAmount[1])
  }

  const matches = [...text.matchAll(/(?:₹|rs\.?|inr\s*)?(\d+)/gi)].map((m) =>
    Number(m[1])
  )

  if (!matches.length) {
    return null
  }

  const filtered = matches.filter((n) => {
    if (renewalDay !== null && n === renewalDay) {
      return false
    }
    if (numberUsedAsRenewalDate(text, n)) {
      return false
    }
    return n >= 10
  })

  if (!filtered.length) {
    return null
  }

  return filtered[filtered.length - 1]
}

function stripDateAsAmount(draft) {
  if (
    draft.amount != null &&
    draft.renewalDay != null &&
    draft.amount === draft.renewalDay
  ) {
    return { ...draft, amount: null }
  }
  return draft
}

function extractRenewal(text) {
  let renewalDay = null
  let renewalMonth = null

  const renewsMonthDay = text.match(
    new RegExp(`renews?\\s+on\\s+(${MONTH_PATTERN})\\s+(\\d{1,2})`, 'i')
  )
  const renewsDayMonth = text.match(
    new RegExp(`renews?\\s+on\\s+(\\d{1,2})\\s+(${MONTH_PATTERN})`, 'i')
  )
  const renewsDay = text.match(
    /renews?\s+on\s+(\d{1,2})(?:st|nd|rd|th)?/i
  )
  const onThe = text.match(/on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?/i)
  const onDay = text.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)
  const monthDay = text.match(
    new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2})`, 'i')
  )
  const dayMonth = text.match(
    new RegExp(`(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(${MONTH_PATTERN})\\b`, 'i')
  )
  const dayOnly = text.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i)
  const everyMonth = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+every\s+month/i)

  if (renewsMonthDay) {
    renewalMonth = renewsMonthDay[1]
    renewalDay = Number(renewsMonthDay[2])
  } else if (renewsDayMonth) {
    renewalDay = Number(renewsDayMonth[1])
    renewalMonth = renewsDayMonth[2]
  } else if (renewsDay) {
    renewalDay = Number(renewsDay[1])
  } else if (onThe) {
    renewalDay = Number(onThe[1])
  } else if (onDay) {
    renewalDay = Number(onDay[1])
  } else if (dayMonth) {
    renewalDay = Number(dayMonth[1])
    renewalMonth = dayMonth[2]
  } else if (monthDay) {
    renewalMonth = monthDay[1]
    renewalDay = Number(monthDay[2])
  } else if (everyMonth) {
    renewalDay = Number(everyMonth[1])
  } else if (dayOnly) {
    renewalDay = Number(dayOnly[1])
  }

  return { renewalDay, renewalMonth }
}

function extractServiceName(text) {
  if (/^\d/.test(text)) {
    return null
  }

  const renewService = text.match(/^renew(?:s)?\s+(?:the\s+)?([a-z0-9+][a-z0-9+.-]*)\b/i)
  if (renewService) {
    return cleanServiceName(renewService[1])
  }

  const svcRec = text.match(/^(.+?)\s+(monthly|yearly)\s*$/i)
  if (svcRec) {
    return cleanServiceName(svcRec[1])
  }

  const intentPatterns = [
    /^need reminder for (.+)$/i,
    /^add (.+)$/i,
    /^renewal reminder(?:\s+for)?\s*(.+)$/i,
    /^(.+?)\s+subscription$/i,
    /^i pay \d+ for (.+?)(?:\s+every|\s*$)/i,
    /^(.+?)\s+renews?\b/i
  ]

  for (const regex of intentPatterns) {
    const match = text.match(regex)
    if (match?.[1]) {
      return cleanServiceName(match[1])
    }
  }

  const lower = text.toLowerCase().trim()

  if (/^(show|list|delete|remove|cancel|help|hi|hello|start)\b/.test(lower)) {
    return null
  }
  if (/^delete\s+all\b/.test(lower)) {
    return null
  }

  if (
    /^[a-z0-9+][a-z0-9+\s.-]{0,40}$/i.test(text) &&
    !/^(monthly|yearly|renewal reminder|\d+)$/i.test(lower) &&
    !extractRecurrence(text) &&
    !/\s+\d{2,}\s*$/.test(text)
  ) {
    return cleanServiceName(text)
  }

  return null
}

function extractPartial(text) {
  const { renewalDay, renewalMonth } = extractRenewal(text)
  const nameAmount = text.match(
    /^([a-z0-9+][a-z0-9+\s.-]{0,30}?)\s+(\d{2,})$/i
  )

  return {
    serviceName: nameAmount
      ? cleanServiceName(nameAmount[1])
      : extractServiceName(text),
    amount: nameAmount
      ? Number(nameAmount[2])
      : extractAmount(text, renewalDay),
    recurrence: extractRecurrence(text),
    renewalDay,
    renewalMonth
  }
}

function isDifferentService(nameA, nameB) {
  if (!nameA || !nameB) {
    return false
  }

  return nameA.toLowerCase() !== nameB.toLowerCase()
}

function isServiceSwitch(pending, fromText) {
  if (!pending?.serviceName || !fromText.serviceName) {
    return false
  }

  return isDifferentService(pending.serviceName, fromText.serviceName)
}

function mergeDraft(pending, text) {
  const fromText = extractPartial(text)

  if (isServiceSwitch(pending, fromText)) {
    const hasFollowUpFields = Boolean(
      fromText.amount != null ||
        fromText.recurrence ||
        fromText.renewalDay != null ||
        fromText.renewalMonth
    )

    if (!hasFollowUpFields) {
      return {
        serviceName: fromText.serviceName,
        amount: null,
        recurrence: null,
        renewalDay: null,
        renewalMonth: null
      }
    }

    return {
      serviceName: fromText.serviceName,
      amount: fromText.amount ?? null,
      recurrence: fromText.recurrence || null,
      renewalDay: fromText.renewalDay ?? null,
      renewalMonth: fromText.renewalMonth || null
    }
  }

  return {
    serviceName: pending.serviceName || fromText.serviceName || null,
    amount: fromText.amount ?? pending.amount ?? null,
    recurrence: fromText.recurrence || pending.recurrence || null,
    renewalDay: fromText.renewalDay ?? pending.renewalDay ?? null,
    renewalMonth: fromText.renewalMonth || pending.renewalMonth || null
  }
}

function buildCombinedString(draft, text) {
  if (draft.serviceName) {
    return `${draft.serviceName} ${text}`
  }

  return text
}

function needsRenewalDate(recurrence) {
  if (!recurrence) {
    return false
  }

  if (recurrence === 'monthly') {
    return true
  }

  return /^\d+\s+months?$/i.test(recurrence)
}

function getMissing(draft) {
  const missing = []

  if (!draft.serviceName) {
    missing.push('serviceName')
  }
  if (!draft.recurrence) {
    missing.push('recurrence')
  }
  if (
    needsRenewalDate(draft.recurrence) &&
    !draft.renewalDay &&
    !draft.renewalMonth
  ) {
    missing.push('renewalDate')
  }

  return missing
}

function finalizePatternMatch(parsed) {
  return finalizeDraft({
    serviceName: parsed.serviceName,
    amount: parsed.amount,
    recurrence: parsed.recurrence,
    renewalDay: parsed.renewalDay ?? null,
    renewalMonth: parsed.renewalMonth ?? null
  })
}

function finalizeDraft(draft) {
  draft = stripDateAsAmount(draft)
  const missing = getMissing(draft)

  if (!missing.length) {
    return subscriptionResult(draft)
  }

  return {
    success: false,
    type: 'incomplete',
    draft,
    missing
  }
}

function hasPartialSignal(draft) {
  return Boolean(
    draft.serviceName ||
      draft.amount ||
      draft.recurrence ||
      draft.renewalDay ||
      draft.renewalMonth
  )
}

function parseMessage(text, pending = null) {
  const normalized = normalizeText(text)

  if (!normalized) {
    return { success: false, type: 'unknown' }
  }

  if (/^(?:renewal reminder|need reminder)$/i.test(normalized)) {
    return finalizeDraft({
      serviceName: null,
      amount: null,
      recurrence: null,
      renewalDay: null,
      renewalMonth: null
    })
  }

  if (pending) {
    const fromText = extractPartial(normalized)
    const switching = isServiceSwitch(pending, fromText)
    const combined = normalizeText(
      switching && !fromText.amount && !fromText.recurrence
        ? normalized
        : buildCombinedString(pending, normalized)
    )
    const fromCombined = tryPatterns(combined)

    if (fromCombined) {
      return finalizePatternMatch(fromCombined)
    }

    return finalizeDraft(mergeDraft(pending, normalized))
  }

  const patternResult = tryPatterns(normalized)

  if (patternResult) {
    return finalizePatternMatch(patternResult)
  }

  const partial = extractPartial(normalized)

  if (hasPartialSignal(partial)) {
    return finalizeDraft(partial)
  }

  return { success: false, type: 'unknown' }
}

function mergePendingDrafts(existing, incoming) {
  if (!existing) {
    return { ...incoming }
  }

  if (!incoming) {
    return { ...existing }
  }

  if (isServiceSwitch(existing, incoming)) {
    const hasFollowUpFields = Boolean(
      incoming.amount != null ||
        incoming.recurrence ||
        incoming.renewalDay != null ||
        incoming.renewalMonth
    )

    if (!hasFollowUpFields) {
      return {
        serviceName: incoming.serviceName,
        amount: null,
        recurrence: null,
        renewalDay: null,
        renewalMonth: null
      }
    }

    return {
      serviceName: incoming.serviceName,
      amount: incoming.amount ?? null,
      recurrence: incoming.recurrence || null,
      renewalDay: incoming.renewalDay ?? null,
      renewalMonth: incoming.renewalMonth || null
    }
  }

  return {
    serviceName: incoming.serviceName || existing.serviceName || null,
    amount: incoming.amount ?? existing.amount ?? null,
    recurrence: incoming.recurrence || existing.recurrence || null,
    renewalDay: incoming.renewalDay ?? existing.renewalDay ?? null,
    renewalMonth: incoming.renewalMonth || existing.renewalMonth || null
  }
}

module.exports = {
  parseMessage,
  mergePendingDrafts,
  finalizeDraft,
  getMissing
}
