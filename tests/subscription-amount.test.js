const assert = require('node:assert/strict')
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
const { parseMessage, getMissing } = require('../src/services/parserCore')
const { formatSubscriptionAdded } = require('../src/formatters/subscriptionFormatter')

const full199 = parseMessage('Prime 199 monthly on 23rd')
assert.equal(full199.success, true)
assert.equal(full199.amount, 199)
assert.equal(full199.renewalDay, 23)

const noAmount = parseMessage('Netflix renews on 27th every month')
assert.equal(noAmount.success, true)
assert.equal(noAmount.serviceName, 'Netflix')
assert.equal(noAmount.renewalDay, 27)
assert.equal(noAmount.amount, null)
assert.ok(!getMissing(noAmount).includes('amount'))

const withAmount = parseMessage('Netflix renews on 27th every month for ₹649')
assert.equal(withAmount.success, true)
assert.equal(withAmount.amount, 649)

assert.match(formatSubscriptionAdded(noAmount), /✅ Got it/)
assert.match(formatSubscriptionAdded(noAmount), /Every month · 27th/)
assert.doesNotMatch(formatSubscriptionAdded(noAmount), /₹/)

assert.match(formatSubscriptionAdded(withAmount), /Every month · 27th/)
assert.doesNotMatch(formatSubscriptionAdded(withAmount), /₹649/)

console.log('subscription-amount tests passed')
