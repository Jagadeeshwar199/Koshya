const assert = require('node:assert/strict')
const { parseSubscription } = require('../services/parserService')
const { parseSubscriptionInput } = require('../services/parseApiService')

const complete = parseSubscription(
  'Netflix renews on 27th every month - 149'
)

assert.equal(complete.status, 'complete')
assert.equal(complete.success, true)
assert.equal(complete.subscription.serviceName, 'Netflix')
assert.equal(complete.subscription.amount, 149)
assert.equal(complete.missing.length, 0)
assert.equal(complete.draft, null)

const incomplete = parseSubscription('Netflix 149 monthly')

assert.equal(incomplete.status, 'incomplete')
assert.equal(incomplete.success, false)
assert.equal(incomplete.subscription, null)
assert.ok(incomplete.missing.includes('renewalDate'))

const switched = parseSubscription('prime', {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
})

assert.equal(switched.draft.serviceName, 'Prime')

const validation = parseSubscriptionInput({ text: '   ' })

assert.equal(validation.status, 'error')
assert.equal(validation.error, 'text must be a non-empty string')

console.log('Parse API tests passed: 4')
