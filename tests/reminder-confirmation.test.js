const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  formatReminderTime,
  formatReminderConfirmation
} = require('../src/controllers/reminderController')

const now = new Date('2026-05-31T19:25:02.591Z')
const reminder = {
  message: 'Exercise',
  triggerAt: '2026-06-01T19:25:02.591'
}

assert.equal(
  formatReminderTime(reminder.triggerAt, now),
  'Tomorrow at 12:55 AM IST'
)

assert.equal(
  formatReminderConfirmation(reminder, now),
`✅ Reminder created

Exercise
Tomorrow at 12:55 AM IST

This reminder will be sent once.`
)

console.log('Reminder confirmation tests passed: 2')
