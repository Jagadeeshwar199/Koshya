const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
const { parseMessage } = require('../src/services/parserCore')
const { detectIntent, INTENTS } = require('../src/services/intentService')
const {
  formatSubscription,
  formatSubscriptionAdded,
  scheduleLine
} = require('../src/formatters/subscriptionFormatter')

const prime = parseMessage('Prime renews on 23rd March monthly - 149')
assert.equal(prime.success, true)
assert.equal(prime.recurrence, 'monthly')
assert.equal(prime.renewalDay, 23)
assert.equal(prime.amount, 149)
assert.equal(prime.renewalMonth, null)

const netflix = parseMessage('Netflix renewls on 27th every month - 149')
assert.equal(netflix.serviceName, 'Netflix')

assert.match(
  formatSubscriptionAdded(prime),
  /Renews every month on 23rd/
)
assert.match(formatSubscriptionAdded(prime), /Next:/)

const spotify = {
  serviceName: 'Spotify',
  amount: 119,
  recurrence: 'monthly',
  renewalDay: 5,
  renewalMonth: null
}
assert.match(formatSubscription(spotify), /₹119\/month/)
assert.match(formatSubscription(spotify), /Next:/)

assert.equal(
  detectIntent('Remind me tomorw at 8 PM').entities.date?.value,
  'tomorrow'
)
assert.equal(detectIntent('Remind me tomorw at 8 PM').intent, INTENTS.REMINDER_CREATE)

assert.equal(scheduleLine({ recurrence: 'yearly', renewalDay: 23, renewalMonth: 'Mar' }), 'Renews every year on 23rd Mar')

console.log('Subscription display tests passed: 8')
