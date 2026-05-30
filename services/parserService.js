const MONTH_PATTERN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

const CURRENCY = '(?:₹|rs\\.?|inr)\\s*'

function normalizeText(text) {
  return String(text)
    .trim()
    .replace(/[\u2013\u2014\u2212–—]/g, '-')
    .replace(/₹/g, '₹')
    .replace(/(\D)-(\d)/g, '$1 - $2')
    .replace(/(\d)-(\D)/g, '$1 - $2')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
}

function cleanServiceName(name) {
  return name.replace(/[:;,.-]+$/g, '').trim()
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
        `^(.+?) renews on (\\d{1,2})(?:st|nd|rd|th)? every month(?:\\s*-)?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: Number(m[2]),
        renewalMonth: null,
        recurrence: 'monthly',
        amount: Number(m[3])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every (\\d+) months?\\s*-?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: `${m[4]} months`,
        amount: Number(m[5])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2}) (${MONTH_PATTERN}) every (\\d+) months?\\s*-?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: Number(m[2]),
        renewalMonth: m[3],
        recurrence: `${m[4]} months`,
        amount: Number(m[5])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every year\\s*-?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: 'yearly',
        amount: Number(m[4])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (${MONTH_PATTERN}) (\\d{1,2}) every month\\s*-?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalMonth: m[2],
        renewalDay: Number(m[3]),
        recurrence: 'monthly',
        amount: Number(m[4])
      })
    },
    {
      regex: /^(.+?)\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:\/mo|per month|every month|monthly)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'monthly',
        amount: Number(m[2])
      })
    },
    {
      regex: /^(.+?)\s+monthly\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'monthly',
        amount: Number(m[2])
      })
    },
    {
      regex: /^(.+?)\s+(?:₹|rs\.?|inr)?\s*(\d+)\s+yearly\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'yearly',
        amount: Number(m[2])
      })
    },
    {
      regex: /^(.+?)\s+yearly\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'yearly',
        amount: Number(m[2])
      })
    },
    {
      regex:
        /^(?:annual|annually)\s+(.+?)\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'yearly',
        amount: Number(m[2])
      })
    },
    {
      regex:
        /^(.+?)\s+(?:₹|rs\.?|inr)?\s*(\d+)\s+(?:annual|annually)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'yearly',
        amount: Number(m[2])
      })
    },
    {
      regex:
        /^(.+?)\s+every\s+(\d+)\s+months?\s*-?\s*(?:₹|rs\.?|inr)?\s*(\d+)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: `${m[2]} months`,
        amount: Number(m[3])
      })
    },
    {
      regex:
        /^(.+?)\s+quarterly\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: '3 months',
        amount: Number(m[2])
      })
    },
    {
      regex:
        /^(?:₹|rs\.?|inr)?\s*(\d+)\s+(.+?)\s+(?:monthly|every month|per month|\/mo)\s*$/i,
      map: (m) => ({
        serviceName: m[2].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'monthly',
        amount: Number(m[1])
      })
    },
    {
      regex:
        /^(.+?):\s*(?:₹|rs\.?|inr)?\s*(\d+)\s+(?:monthly|every month)\s*$/i,
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: null,
        renewalMonth: null,
        recurrence: 'monthly',
        amount: Number(m[2])
      })
    },
    {
      regex: new RegExp(
        `^(.+?) renews on (\\d{1,2})(?:st|nd|rd|th)? every month(?:\\s+for)?\\s*(?:${CURRENCY})?(\\d+)\\s*$`,
        'i'
      ),
      map: (m) => ({
        serviceName: m[1].trim(),
        renewalDay: Number(m[2]),
        renewalMonth: null,
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

function parseHeuristic(text) {
  const lower = text.toLowerCase()

  let recurrence = null

  const quarterMatch = lower.match(
    /every\s+(\d+)\s+months?|quarterly/
  )
  const yearlyMatch = lower.match(
    /every\s+year|yearly|annually|annual|per\s+year|\/year|\/yr\b/
  )
  const monthlyMatch = lower.match(
    /every\s+month|monthly|per\s+month|\/month|\/mo\b/
  )

  if (quarterMatch) {
    const months = quarterMatch[1] || '3'
    recurrence = `${months} months`
  } else if (yearlyMatch) {
    recurrence = 'yearly'
  } else if (monthlyMatch) {
    recurrence = 'monthly'
  }

  if (!recurrence) {
    return null
  }

  let renewalDay = null
  let renewalMonth = null

  const renewsOnMonthDay = text.match(
    new RegExp(
      `renews?\\s+on\\s+(${MONTH_PATTERN})\\s+(\\d{1,2})`,
      'i'
    )
  )
  const renewsOnDayMonth = text.match(
    new RegExp(
      `renews?\\s+on\\s+(\\d{1,2})\\s+(${MONTH_PATTERN})`,
      'i'
    )
  )
  const renewsOnDayOnly = text.match(
    /renews?\s+on\s+(\d{1,2})(?:st|nd|rd|th)?/i
  )

  if (renewsOnMonthDay) {
    renewalMonth = renewsOnMonthDay[1]
    renewalDay = Number(renewsOnMonthDay[2])
  } else if (renewsOnDayMonth) {
    renewalDay = Number(renewsOnDayMonth[1])
    renewalMonth = renewsOnDayMonth[2]
  } else if (renewsOnDayOnly) {
    renewalDay = Number(renewsOnDayOnly[1])
  }

  const numbers = []
  const amountPattern = /(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d{2})?)/gi
  let amountMatch

  while ((amountMatch = amountPattern.exec(text)) !== null) {
    const value = Number(amountMatch[1])
    if (!Number.isNaN(value)) {
      numbers.push({
        value,
        index: amountMatch.index,
        raw: amountMatch[0]
      })
    }
  }

  if (numbers.length === 0) {
    return null
  }

  const dashAmount = text.match(
    /-\s*(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d{2})?)\s*$/i
  )
  let amount = null

  if (dashAmount) {
    amount = Number(dashAmount[1])
  } else {
    const candidates = numbers.filter((n) => {
      if (renewalDay !== null && n.value === renewalDay) {
        return false
      }
      if (
        renewalDay !== null &&
        renewalMonth &&
        n.value <= 31 &&
        numbers.length > 1
      ) {
        const monthDay = text.match(
          new RegExp(
            `${MONTH_PATTERN}\\s+${renewalDay}\\b`,
            'i'
          )
        )
        if (monthDay && n.value === renewalDay) {
          return false
        }
      }
      return true
    })

    if (candidates.length === 0) {
      return null
    }

    amount = candidates[candidates.length - 1].value
  }

  if (!amount || amount <= 0) {
    return null
  }

  let serviceName = text

  const removablePatterns = [
    new RegExp(`renews?\\s+on\\s+${MONTH_PATTERN}\\s+\\d{1,2}`, 'gi'),
    new RegExp(`renews?\\s+on\\s+\\d{1,2}\\s+${MONTH_PATTERN}`, 'gi'),
    /renews?\s+on\s+\d{1,2}(?:st|nd|rd|th)?/gi,
    /every\s+\d+\s+months?/gi,
    /every\s+year/gi,
    /every\s+month/gi,
    /quarterly/gi,
    /monthly/gi,
    /yearly/gi,
    /annually?/gi,
    /per\s+month/gi,
    /per\s+year/gi,
    /\/mo\b/gi,
    /\/month\b/gi,
    /(?:₹|rs\.?|inr)\s*\d+(?:\.\d{2})?/gi,
    /\d+(?:\.\d{2})?/g,
    /\s*-\s*/g,
    /\s+for\s*$/gi
  ]

  for (const pattern of removablePatterns) {
    serviceName = serviceName.replace(pattern, ' ')
  }

  serviceName = serviceName.replace(/\s+/g, ' ').trim()

  if (!serviceName) {
    return null
  }

  return subscriptionResult({
    serviceName,
    renewalDay,
    renewalMonth,
    recurrence,
    amount
  })
}

function parseMessage(text) {
  const normalized = normalizeText(text)

  if (!normalized) {
    return { success: false }
  }

  const patternResult = tryPatterns(normalized)
  if (patternResult) {
    return patternResult
  }

  const heuristicResult = parseHeuristic(normalized)
  if (heuristicResult) {
    return heuristicResult
  }

  return { success: false }
}

module.exports = parseMessage
