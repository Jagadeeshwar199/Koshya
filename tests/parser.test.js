const assert = require('node:assert/strict')
const parseMessage = require('../services/parserService')

const shouldParse = [
  {
    input: 'Netflix renews on 27th every month - 149',
    expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }
  },
  {
    input: 'Spotify renews on 15th every month - 119',
    expect: { serviceName: 'Spotify', amount: 119, recurrence: 'monthly', renewalDay: 15 }
  },
  {
    input: 'Prime renews on Jan 20 every year - 1499',
    expect: { serviceName: 'Prime', amount: 1499, recurrence: 'yearly', renewalDay: 20, renewalMonth: 'Jan' }
  },
  {
    input: 'JioHotstar renews on Apr 12 every 3 months - 599',
    expect: { serviceName: 'JioHotstar', amount: 599, recurrence: '3 months', renewalDay: 12, renewalMonth: 'Apr' }
  },
  {
    input: 'ChatGPT renews on 5th every month - 1700',
    expect: { serviceName: 'ChatGPT', amount: 1700, recurrence: 'monthly', renewalDay: 5 }
  },
  {
    input: 'My Netflix subscription is 149 every month on the 27th',
    expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }
  },
  {
    input: 'I pay 119 for Spotify every month',
    expect: { serviceName: 'Spotify', amount: 119, recurrence: 'monthly' }
  },
  {
    input: 'Prime costs 1499 yearly and renews on Jan 20',
    expect: { serviceName: 'Prime', amount: 1499, recurrence: 'yearly', renewalDay: 20, renewalMonth: 'Jan' }
  },
  {
    input: 'JioHotstar renews every 3 months on April 12 for 599',
    expect: { serviceName: 'JioHotstar', amount: 599, recurrence: '3 months', renewalDay: 12, renewalMonth: 'April' }
  },
  {
    input: 'ChatGPT Plus is 1700 monthly',
    expect: { serviceName: 'ChatGPT Plus', amount: 1700, recurrence: 'monthly' }
  },
  { input: 'Netflix 149 monthly', expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly' } },
  { input: 'Netflix ₹149 monthly', expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly' } },
  { input: 'Prime yearly ₹1499', expect: { serviceName: 'Prime', amount: 1499, recurrence: 'yearly' } },
  { input: 'Airtel recharge ₹299 every month', expect: { serviceName: 'Airtel', amount: 299, recurrence: 'monthly' } },
  { input: 'NETFLIX -149 monthly', expect: { serviceName: 'NETFLIX', amount: 149, recurrence: 'monthly' } },
  { input: 'Netflix = 149 monthly', expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly' } },
  { input: 'Netflix,149,monthly', expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly' } },
  { input: 'Netflix renews monthly ₹149', expect: { serviceName: 'Netflix', amount: 149, recurrence: 'monthly' } },
  { input: 'Spotify every 2 months - 119', expect: { serviceName: 'Spotify', amount: 119, recurrence: '2 months' } },
  { input: 'Adobe yearly - 23999', expect: { serviceName: 'Adobe', amount: 23999, recurrence: 'yearly' } }
]

const shouldFail = [
  'Spotify ₹119',
  'Netflix : 149',
  'Netflix',
  '149',
  'monthly',
  'Need reminder for Netflix',
  'Netflix subscription',
  'Add Netflix',
  'Renewal reminder'
]

let passed = 0

for (const { input, expect } of shouldParse) {
  const result = parseMessage(input)
  assert.equal(result.success, true, `expected parse: ${input}`)

  for (const [key, value] of Object.entries(expect)) {
    assert.equal(result[key], value, `${input}: ${key} expected ${value}, got ${result[key]}`)
  }

  passed++
}

for (const input of shouldFail) {
  const result = parseMessage(input)
  assert.equal(result.success, false, `expected reject: ${input}`)
  passed++
}

const total = shouldParse.length + shouldFail.length
console.log(`Parser tests passed: ${passed}/${total}`)
console.log(
  `Accuracy on your test sheet: ${((shouldParse.length / total) * 100).toFixed(1)}% parse rate (${shouldParse.length} subscriptions), ${shouldFail.length} correctly rejected`
)
