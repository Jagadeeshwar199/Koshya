const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

const CURRENCY = '(?:₹|rs\\.?|inr)\\s*'
const AMOUNT = '(?:₹|rs\\.?|inr\\s*)?(\\d+)'

function normalizeText(text) {
  return String(text)
    .trim()
    .replace(/[\u2013\u2014\u2212–—]/g, '-')
    .replace(/,/g, ' ')
    .replace(/=/g, ' ')
    .replace(/(\D)-(\d)/g, '$1 - $2')
    .replace(/(\d)-(\D)/g, '$1 - $2')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/:(?=\s*\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanServiceName(name) {
  return name
    .replace(/[:;,.=\-]+$/g, '')
    .replace(/^(?:my|the|a|an)\s+/i, '')
    .replace(/\s+subscription$/i, '')
    .replace(/\s+(?:is|are)$/i, '')
    .replace(/\s+costs?$/i, '')
    .replace(/\s+recharge$/i, '')
    .replace(/\s+renews?$/i, '')
    .replace(/\s+and$/i, '')
    .trim()
}

function subscriptionResult(fields) {
  return {
    success: true,
    type: 'subscription',
    serviceName: cleanServiceName(fields.serviceName),
    renewalDay: fields.renewalDay ?? null,
    renewalMonth: fields.renewalMonth ?? null,
    recurrence: fields.recurrence,
    amount: fields.amount
  }
}

function tryPatterns(text) {
  const patterns = [
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

function extractAmount(text, renewalDay) {
  const matches = [...text.matchAll(/(?:₹|rs\.?|inr\s*)?(\d+)/gi)].map(
    (m) => Number(m[1])
  )

  if (!matches.length) {
    return null
  }

  const filtered = matches.filter((n) => {
    if (renewalDay !== null && n === renewalDay) {
      return false
    }
    return n >= 10
  })

  if (!filtered.length) {
    return matches[matches.length - 1]
  }

  return filtered[filtered.length - 1]
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
  const monthDay = text.match(
    new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2})`, 'i')
  )

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
  } else if (monthDay) {
    renewalMonth = monthDay[1]
    renewalDay = Number(monthDay[2])
  }

  return { renewalDay, renewalMonth }
}

function extractServiceName(text) {
  const intentPatterns = [
    /^need reminder for (.+)$/i,
    /^add (.+)$/i,
    /^renewal reminder(?:\s+for)?\s*(.+)$/i,
    /^(.+?)\s+subscription$/i,
    /^i pay \d+ for (.+?)(?:\s+every|\s*$)/i,
    /^(.+?)\s+₹?\s*\d+/i,
    /^(.+?)\s+renews?\b/i
  ]

  for (const regex of intentPatterns) {
    const match = text.match(regex)
    if (match?.[1]) {
      return cleanServiceName(match[1])
    }
  }

  const lower = text.toLowerCase().trim()

  if (
    /^[a-z0-9+][a-z0-9+\s.-]{0,40}$/i.test(text) &&
    !/^(monthly|yearly|renewal reminder|\d+)$/i.test(lower) &&
    !extractRecurrence(text)
  ) {
    return cleanServiceName(text)
  }

  return null
}

function extractPartial(text) {
  const { renewalDay, renewalMonth } = extractRenewal(text)

  return {
    serviceName: extractServiceName(text),
    amount: extractAmount(text, renewalDay),
    recurrence: extractRecurrence(text),
    renewalDay,
    renewalMonth
  }
}

function mergeDraft(pending, text) {
  const fromText = extractPartial(text)

  return {
    serviceName: fromText.serviceName || pending.serviceName || null,
    amount: fromText.amount ?? pending.amount ?? null,
    recurrence: fromText.recurrence || pending.recurrence || null,
    renewalDay: fromText.renewalDay ?? pending.renewalDay ?? null,
    renewalMonth: fromText.renewalMonth || pending.renewalMonth || null
  }
}

function buildCombinedString(draft, text) {
  const parts = []

  if (draft.serviceName) {
    parts.push(draft.serviceName)
  }
  if (draft.amount) {
    parts.push(String(draft.amount))
  }
  if (draft.recurrence) {
    parts.push(draft.recurrence)
  }
  if (draft.renewalMonth && draft.renewalDay) {
    parts.push(`renews on ${draft.renewalMonth} ${draft.renewalDay}`)
  } else if (draft.renewalDay) {
    parts.push(`renews on ${draft.renewalDay}th every month`)
  }

  parts.push(text)
  return parts.join(' ')
}

function getMissing(draft) {
  const missing = []

  if (!draft.serviceName) {
    missing.push('serviceName')
  }
  if (!draft.amount) {
    missing.push('amount')
  }
  if (!draft.recurrence) {
    missing.push('recurrence')
  }

  return missing
}

function finalizeDraft(draft) {
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
    const combined = normalizeText(
      buildCombinedString(pending, normalized)
    )
    const fromCombined = tryPatterns(combined)

    if (fromCombined) {
      return fromCombined
    }

    return finalizeDraft(mergeDraft(pending, normalized))
  }

  const patternResult = tryPatterns(normalized)

  if (patternResult) {
    return patternResult
  }

  const partial = extractPartial(normalized)

  if (hasPartialSignal(partial)) {
    return finalizeDraft(partial)
  }

  return { success: false, type: 'unknown' }
}

module.exports = parseMessage
