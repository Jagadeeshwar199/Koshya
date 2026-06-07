const assert = require('node:assert/strict')

process.env.TZ = 'UTC'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { detectIntent, needsExplicitTimePrompt } = require('../src/services/intentService')
const {
  computeNextRenewalDate,
  computeReminderRenewalDate,
  resolveTriggerAt,
  extractReminderTitle
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
  triggerIso('remind me to test koshya in 2 minutes'),
  '2026-05-31T18:27:00.000Z',
  'in 2 minutes should schedule relative to now'
)

assert.equal(
  triggerIso('Remind me to drink water after 2 minutes'),
  '2026-05-31T18:27:00.000Z',
  'after 2 minutes should schedule relative to now'
)

const offsetCases = [
  ['after 10 mins', 10],
  ['in 1 hour', 60],
  ['after 3 hours', 180],
  ['in 30 minutes', 30],
  ['after 1 day', 1440],
  ['in 2 days', 2880]
]

for (const [phrase, minutes] of offsetCases) {
  const intent = detectIntent(`Remind me to drink water ${phrase}`)
  assert.equal(intent.entities.date.kind, 'offset', phrase)
  assert.equal(intent.entities.date.minutes, minutes, phrase)
  assert.equal(!needsExplicitTimePrompt(intent.entities), true, phrase)
}

assert.equal(
  extractReminderTitle('Remind me to drink water after 2 minutes'),
  'Drink water'
)
assert.equal(extractReminderTitle('Call mom in 1 hour'), 'Call mom')

console.log('Reminder tests passed:', 11 + offsetCases.length + 2)
