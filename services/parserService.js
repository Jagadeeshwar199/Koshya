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

function isIncompleteMessage(text) {
  const lower = text.toLowerCase()

  if (/^(?:need reminder|add |renewal reminder)/i.test(text)) {
    return true
  }

  if (/subscription$/i.test(text) && !/\d/.test(text)) {
    return true
  }

  if (/^[^\\d]+$/.test(text) && !/monthly|yearly|every/i.test(text)) {
    return true
  }

  if (/^\\d+$/.test(text)) {
    return true
  }

  if (/^monthly$/i.test(text)) {
    return true
  }

  const hasRecurrence =
    /every\\s+month|monthly|yearly|every\\s+\\d+\\s+months?|every\\s+year|quarterly/i.test(
      lower
    )
  const hasAmount = /₹\\s*\\d+|(?:^|\\s)\\d{2,}/.test(text)

  if (hasAmount && !hasRecurrence) {
    return true
  }

  if (/^(.+?)\\s*:\\s*\\d+\\s*$/i.test(text) && !hasRecurrence) {
    return true
  }

  return false
}

function parseMessage(text) {
  const normalized = normalizeText(text)

  if (!normalized || isIncompleteMessage(normalized)) {
    return { success: false }
  }

  const patternResult = tryPatterns(normalized)
  if (patternResult) {
    return patternResult
  }

  return { success: false }
}

module.exports = parseMessage
