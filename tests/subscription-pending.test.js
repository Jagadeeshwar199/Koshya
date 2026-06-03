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
assert.deepEqual(getMissing(step1.draft), ['amount', 'renewalDate'])

const case2 = simulate([
  'Renew the prime 23 rd june monthly',
  'Prime 199'
])
assert.equal(case2.success, true)
assert.equal(case2.serviceName, 'Prime')
assert.equal(case2.amount, 199)
assert.equal(case2.renewalDay, 23)

const renewPartial = parseMessage('Renew the prime 23 rd june monthly')
assert.equal(renewPartial.type, 'incomplete')
assert.deepEqual(getMissing(renewPartial.draft), ['amount'])

const netflix = parseMessage('Netflix renewls 27th every month')
assert.equal(netflix.type, 'incomplete')
assert.equal(netflix.draft.serviceName, 'Netflix')
assert.equal(netflix.draft.renewalDay, 27)
assert.equal(netflix.draft.recurrence, 'monthly')
assert.deepEqual(getMissing(netflix.draft), ['amount'])

assert.equal(
  detectIntent('Remind me tomorw at 8 PM').intent,
  INTENTS.REMINDER_CREATE
)

console.log('subscription-pending tests passed')
