#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  serializeRecurrenceSchedule,
  inferRecurrenceSchedule,
  computeNextRecurringTriggerAt,
  buildDeliveryUpdate,
  parseRecurrenceSchedule
} = require('../src/services/recurrenceScheduleService')

const base = new Date('2026-06-02T04:30:00.000Z') // 10:00 IST

assert.equal(
  computeNextRecurringTriggerAt({ kind: 'daily', hour: 10, minute: 0 }, base).toISOString(),
  '2026-06-03T04:30:00.000Z',
  'daily +1 day'
)

assert.equal(
  computeNextRecurringTriggerAt({ kind: 'weekly', weekday: 'monday', hour: 10, minute: 0 }, base).toISOString(),
  '2026-06-09T04:30:00.000Z',
  'weekly +7 days'
)

assert.equal(
  computeNextRecurringTriggerAt({ kind: 'monthly', day: 27, hour: 10, minute: 0 }, base).toISOString(),
  '2026-07-27T04:30:00.000Z',
  'monthly next month'
)

const dailySchedule = inferRecurrenceSchedule('Remind me every day to take vitamins', { recurrence: 'daily' }, base)
assert.equal(dailySchedule.kind, 'daily')
const weeklySchedule = inferRecurrenceSchedule('Remind me every sunday to run', {}, base)
assert.equal(weeklySchedule.kind, 'weekly')
const monthlySchedule = inferRecurrenceSchedule('Remind me every month on the 27th', { recurrence: 'monthly', date: { day: 27 } }, base)
assert.equal(monthlySchedule.kind, 'monthly')

const recurringRow = {
  subscription_id: null,
  trigger_at: base.toISOString(),
  schedule_text: serializeRecurrenceSchedule({ kind: 'daily', hour: 10, minute: 0 }),
  message: 'Take vitamins'
}
const dailyUpdate = buildDeliveryUpdate(recurringRow, base)
assert.equal(dailyUpdate.status, 'pending')
assert.equal(dailyUpdate.trigger_at, '2026-06-03T04:30:00.000Z')
assert.equal(dailyUpdate.retry_count, 0)

const oneTimeUpdate = buildDeliveryUpdate(
  { subscription_id: null, trigger_at: base.toISOString(), schedule_text: 'Tomorrow · 10 AM', message: 'Pay rent' },
  base
)
assert.equal(oneTimeUpdate.status, 'sent')
assert.ok(oneTimeUpdate.sent_at)

const subUpdate = buildDeliveryUpdate(
  {
    subscription_id: 'sub-1',
    trigger_at: base.toISOString(),
    schedule_text: null,
    message: 'Netflix renews on 27 Jun'
  },
  base
)
assert.equal(subUpdate.status, 'sent')
assert.equal(subUpdate.trigger_at, undefined)

assert.equal(parseRecurrenceSchedule(recurringRow.schedule_text).kind, 'daily')
assert.equal(parseRecurrenceSchedule(null, '[d]Take vitamins').kind, 'daily')

const weeklyUpdate = buildDeliveryUpdate(
  {
    subscription_id: null,
    trigger_at: base.toISOString(),
    schedule_text: serializeRecurrenceSchedule({ kind: 'weekly', weekday: 'monday', hour: 10, minute: 0 }),
    message: 'Run'
  },
  base
)
assert.equal(weeklyUpdate.status, 'pending')
assert.equal(weeklyUpdate.trigger_at, '2026-06-09T04:30:00.000Z')

const monthlyUpdate = buildDeliveryUpdate(
  {
    subscription_id: null,
    trigger_at: base.toISOString(),
    schedule_text: serializeRecurrenceSchedule({ kind: 'monthly', day: 27, hour: 10, minute: 0 }),
    message: 'Pay rent'
  },
  base
)
assert.equal(monthlyUpdate.status, 'pending')
assert.equal(monthlyUpdate.trigger_at, '2026-07-27T04:30:00.000Z')

console.log('Recurring reminder tests passed: 12')
