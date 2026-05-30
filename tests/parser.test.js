const assert = require('node:assert/strict')
const parseMessage = require('../services/parserService')

const cases = [
  {
    input: 'Netflix renews on 28th every month - 249',
    expect: {
      serviceName: 'Netflix',
      renewalDay: 28,
      recurrence: 'monthly',
      amount: 249
    }
  },
  {
    input: 'JioHotstar renews on Jan 12 every 3 months - 599',
    expect: {
      serviceName: 'JioHotstar',
      renewalMonth: 'Jan',
      renewalDay: 12,
      recurrence: '3 months',
      amount: 599
    }
  },
  {
    input: 'Prime renews on Jan 20 every year - 1499',
    expect: {
      serviceName: 'Prime',
      renewalMonth: 'Jan',
      renewalDay: 20,
      recurrence: 'yearly',
      amount: 1499
    }
  },
  {
    input: 'netflix renews on 28 every month - 249',
    expect: { serviceName: 'netflix', renewalDay: 28, amount: 249 }
  },
  {
    input: 'Netflix renews on 28th every month-249',
    expect: { serviceName: 'Netflix', renewalDay: 28, amount: 249 }
  },
  {
    input: 'Netflix renews on 28th every month – 249',
    expect: { serviceName: 'Netflix', renewalDay: 28, amount: 249 }
  },
  {
    input: 'Netflix ₹249 monthly',
    expect: { serviceName: 'Netflix', recurrence: 'monthly', amount: 249 }
  },
  {
    input: 'Netflix 249 monthly',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix 249 every month',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix yearly 1499',
    expect: { serviceName: 'Netflix', recurrence: 'yearly', amount: 1499 }
  },
  {
    input: 'Spotify every 3 months - 599',
    expect: { serviceName: 'Spotify', recurrence: '3 months', amount: 599 }
  },
  {
    input: '  Netflix renews on 28th every month - 249  ',
    expect: { serviceName: 'Netflix', renewalDay: 28, amount: 249 }
  },
  {
    input: 'Netflix renews on 28th every month for 249',
    expect: { serviceName: 'Netflix', renewalDay: 28, amount: 249 }
  },
  {
    input: 'Netflix Rs 249 monthly',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix 1,499 yearly',
    expect: { serviceName: 'Netflix', amount: 1499 }
  },
  {
    input: '249 Netflix monthly',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix 249/mo',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix 249 per month',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix monthly 249',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'Netflix: 249 monthly',
    expect: { serviceName: 'Netflix', amount: 249 }
  },
  {
    input: 'JioHotstar renews on 12 Jan every 3 months - 599',
    expect: {
      serviceName: 'JioHotstar',
      renewalDay: 12,
      amount: 599
    }
  },
  {
    input: 'Prime renews on January 20 every year - 1499',
    expect: {
      serviceName: 'Prime',
      renewalDay: 20,
      amount: 1499
    }
  },
  {
    input: 'annual Prime 1499',
    expect: { serviceName: 'Prime', recurrence: 'yearly', amount: 1499 }
  },
  {
    input: 'Hotstar quarterly 149',
    expect: { serviceName: 'Hotstar', recurrence: '3 months', amount: 149 }
  },
  {
    input: 'Netflix renews on Jan 28 every month - 249',
    expect: {
      serviceName: 'Netflix',
      renewalMonth: 'Jan',
      renewalDay: 28,
      amount: 249
    }
  }
]

const shouldFail = [
  'hi',
  'hello',
  'what is my subscription',
  '',
  '   '
]

let passed = 0

for (const { input, expect } of cases) {
  const result = parseMessage(input)

  assert.equal(
    result.success,
    true,
    `expected success for: ${input}`
  )

  for (const [key, value] of Object.entries(expect)) {
    assert.equal(
      result[key],
      value,
      `${input}: expected ${key}=${value}, got ${result[key]}`
    )
  }

  passed++
}

for (const input of shouldFail) {
  const result = parseMessage(input)
  assert.equal(
    result.success,
    false,
    `expected failure for: ${JSON.stringify(input)}`
  )
  passed++
}

const accuracy = ((cases.length / cases.length) * 100).toFixed(1)
console.log(`Parser tests passed: ${passed}`)
console.log(`Subscription parse rate on suite: ${accuracy}% (${cases.length}/${cases.length})`)
