const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  formatReminderCancelConfirmation
} = require('../src/formatters/reminderFormatter')
const { detectIntent, INTENTS } = require('../src/services/intentService')

assert.equal(detectIntent('cancel reminder').intent, INTENTS.REMINDER_CANCEL)
assert.equal(detectIntent('cancel exercise reminder').intent, INTENTS.REMINDER_CANCEL)
assert.equal(detectIntent('delete my exercise reminder').intent, INTENTS.REMINDER_CANCEL)
assert.equal(detectIntent('remove reminder').intent, INTENTS.REMINDER_CANCEL)
assert.equal(detectIntent('stop reminding me about exercise').intent, INTENTS.REMINDER_CANCEL)

assert.equal(detectIntent('remove Netflix').intent, INTENTS.SUBSCRIPTION_DELETE)
assert.equal(detectIntent('delete Netflix subscription').intent, INTENTS.SUBSCRIPTION_DELETE)
assert.equal(detectIntent('cancel Netflix subscription').intent, INTENTS.SUBSCRIPTION_DELETE)
assert.equal(detectIntent('stop tracking Netflix').intent, INTENTS.SUBSCRIPTION_DELETE)

assert.equal(
  formatReminderCancelConfirmation(
    {
      message: 'Exercise',
      triggerAt: '2026-06-01T03:30:00.000Z'
    },
    new Date('2026-05-31T18:25:00.000Z')
  ),
`🗑️ Reminder deleted

Exercise`
)

console.log('Day 13 tests passed: 10')
