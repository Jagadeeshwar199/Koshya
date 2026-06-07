const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { extractReminderTitle } = require('../src/services/reminderService')

assert.equal(detectIntent('delete sleep').intent, INTENTS.DELETE_ENTITY)
assert.equal(detectIntent('Delete Spotify').entities.serviceName, 'Spotify')

assert.equal(
  extractReminderTitle('Remind me to call Raj in the evening'),
  'Call Raj'
)

assert.equal(
  extractReminderTitle('Remind me to renew driving licence tomorrow'),
  'Renew driving licence'
)

assert.equal(
  extractReminderTitle('Remind me to renew Netflix on 27th at 10 am'),
  'Renew Netflix'
)

assert.equal(
  detectIntent('Remind me to renew driving licence tomorrow').entities.serviceName,
  undefined
)

assert.equal(extractReminderTitle('remind me of badminton'), 'Badminton')
assert.equal(extractReminderTitle('remind me about rent'), 'Rent')

console.log('Reminder title tests passed: 8')
