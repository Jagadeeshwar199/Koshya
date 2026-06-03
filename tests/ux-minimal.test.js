const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { detectIntent, INTENTS } = require('../src/services/intentService')
const {
  extractReminderTitle,
  packReminderMessage
} = require('../src/services/reminderService')
const {
  formatReminderConfirmation,
  formatReminderCancelConfirmation
} = require('../src/formatters/reminderFormatter')
const { formatSubscriptionAdded, formatSubscriptionRemoved } = require('../src/formatters/subscriptionFormatter')

assert.equal(detectIntent('delete sleep').intent, INTENTS.DELETE_ENTITY)
assert.equal(detectIntent('delete netflix').intent, INTENTS.DELETE_ENTITY)
assert.equal(detectIntent('remove Netflix').intent, INTENTS.SUBSCRIPTION_DELETE)

assert.equal(
  extractReminderTitle('remind me daily to exercise at 7pm'),
  'exercise'
)
assert.equal(
  extractReminderTitle('remind me to drink water after 8 minutes'),
  'drink water'
)

const now = new Date('2026-06-02T14:00:00.000Z')
const confirm = formatReminderConfirmation(
  {
    message: packReminderMessage('drink water', { daily: false }),
    triggerAt: new Date(now.getTime() + 8 * 60 * 1000).toISOString()
  },
  now
)
assert.match(confirm, /^✅ Reminder set\n\nDrink water\nIn 8 minutes$/)
assert.doesNotMatch(confirm, /show reminders/)

assert.match(
  formatReminderCancelConfirmation({ message: 'Sleep' }),
  /🗑️ Reminder deleted/
)
assert.match(
  formatSubscriptionRemoved({ serviceName: 'Netflix' }),
  /🗑️ Subscription deleted/
)
assert.match(
  formatSubscriptionAdded({
    serviceName: 'Netflix',
    amount: 149,
    recurrence: 'monthly',
    renewalDay: 27
  }),
  /₹149\/month/
)
assert.doesNotMatch(
  formatSubscriptionAdded({
    serviceName: 'Netflix',
    amount: 149,
    recurrence: 'monthly',
    renewalDay: 27
  }),
  /show subscriptions/
)

console.log('ux-minimal tests passed')
