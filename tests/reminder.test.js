const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  computeNextRenewalDate,
  computeReminderRenewalDate
} = require('../src/services/reminderService')

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

const monthly = {
  renewal_day: 27,
  renewal_month: null,
  recurrence: 'monthly'
}

assert.equal(
  isoDate(computeReminderRenewalDate(monthly, new Date('2026-05-31T10:00:00Z'), 7)),
  '2026-05-27',
  'monthly overdue reminder should catch up'
)

assert.equal(
  isoDate(computeNextRenewalDate(monthly, new Date('2026-05-31T10:00:00Z'))),
  '2026-06-27',
  'next monthly renewal should roll forward after renewal day'
)

const yearly = {
  renewal_day: 20,
  renewal_month: 'Jan',
  recurrence: 'yearly'
}

assert.equal(
  isoDate(computeReminderRenewalDate(yearly, new Date('2026-01-22T10:00:00Z'), 7)),
  '2026-01-20',
  'yearly overdue reminder should catch up'
)

const custom = {
  renewal_day: 12,
  renewal_month: 'Apr',
  recurrence: '3 months'
}

assert.equal(
  isoDate(computeReminderRenewalDate(custom, new Date('2026-07-13T10:00:00Z'), 7)),
  '2026-07-12',
  'custom interval overdue reminder should catch up'
)

assert.equal(
  isoDate(computeReminderRenewalDate(custom, new Date('2026-08-01T10:00:00Z'), 7)),
  '2026-10-12',
  'custom interval reminder should find the next interval date'
)

console.log('Reminder tests passed: 5')
