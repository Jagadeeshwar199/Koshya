const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  formatReminderTime,
  formatReminderConfirmation
} = require('../src/formatters/reminderFormatter')

const now = new Date('2026-05-31T18:25:02.591Z')
const reminder = {
  message: 'Exercise',
  triggerAt: '2026-06-01T04:30:00.000Z'
}

assert.deepEqual(formatReminderTime(reminder.triggerAt, now), {
  dateLabel: 'Tomorrow',
  timeLabel: '10 AM'
})

assert.equal(
  formatReminderConfirmation(reminder, now),
`✅ Reminder set

Exercise
Tomorrow, 10 AM

Reply:
change to 7 PM
show reminders`
)

console.log('Reminder confirmation tests passed: 2')
