const assert = require('node:assert/strict')
const {
  parseMessage,
  mergePendingDrafts,
  finalizeDraft,
  getMissing
} = require('../src/services/parserCore')
const { detectIntent, INTENTS } = require('../src/services/intentService')

function simulate(msgs) {
  let pending = null
  for (const msg of msgs) {
    const parsed = parseMessage(msg, pending)
    if (parsed.type === 'subscription' && parsed.success) {
      return parsed
    }
    if (parsed.type === 'incomplete') {
      pending = mergePendingDrafts(pending, parsed.draft)
      const completed = finalizeDraft(pending)
      if (completed.type === 'subscription' && completed.success) {
        return completed
      }
    }
  }
  return finalizeDraft(pending)
}

const case1 = simulate(['Prime monthly', '199', '23rd'])
assert.equal(case1.success, true)
assert.equal(case1.serviceName, 'Prime')
assert.equal(case1.amount, 199)
assert.equal(case1.renewalDay, 23)

const step1 = parseMessage('Prime monthly')
assert.equal(step1.type, 'incomplete')
assert.deepEqual(getMissing(step1.draft), ['renewalDate'])

const case2 = simulate(['Prime monthly', '199', '23rd'])
assert.equal(case2.success, true)
assert.equal(case2.serviceName, 'Prime')
assert.equal(case2.amount, 199)
assert.equal(case2.renewalDay, 23)

const renewPartial = parseMessage('Renew the prime 23 rd june monthly')
assert.equal(renewPartial.success, true)
assert.equal(renewPartial.amount, null)

const netflix = parseMessage('Netflix renewls 27th every month')
assert.equal(netflix.success, true)
assert.equal(netflix.serviceName, 'Netflix')
assert.equal(netflix.renewalDay, 27)
assert.equal(netflix.recurrence, 'monthly')
assert.equal(netflix.amount, null)

assert.equal(
  detectIntent('Remind me tomorw at 8 PM').intent,
  INTENTS.REMINDER_CREATE
)

console.log('subscription-pending tests passed')
