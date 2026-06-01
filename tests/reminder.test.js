const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  computeNextRenewalDate,
  computeReminderRenewalDate,
  resolveTriggerAt
} = require('../src/services/reminderService')
const { detectIntent } = require('../src/services/intentService')

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

function triggerIso(message) {
  return resolveTriggerAt(
    detectIntent(message).entities.date,
    new Date('2026-05-31T18:25:00.000Z')
  ).toISOString()
}

assert.equal(
  triggerIso('remind me to exercise tomorrow'),
  '2026-06-01T04:30:00.000Z',
  'tomorrow defaults to 10 AM IST'
)

assert.equal(
  triggerIso('remind me to exercise tomorrow morning'),
  '2026-06-01T04:30:00.000Z',
  'tomorrow morning defaults to 10 AM IST'
)

assert.equal(
  triggerIso('remind me to exercise tomorrow evening'),
  '2026-06-01T12:30:00.000Z',
  'tomorrow evening defaults to 6 PM IST'
)

assert.equal(
  triggerIso('remind me to exercise tomorrow at 5pm'),
  '2026-06-01T11:30:00.000Z',
  'explicit 5 PM time should be honored'
)

assert.equal(
  triggerIso('remind me to exercise next Monday'),
  '2026-06-01T04:30:00.000Z',
  'next Monday defaults to 10 AM IST'
)

assert.equal(
  triggerIso('remind me to stretch in 2 minutes'),
  '2026-05-31T18:27:00.000Z',
  'relative minute reminders should be scheduled from now'
)

console.log('Reminder tests passed: 11')
