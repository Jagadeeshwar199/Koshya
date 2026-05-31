const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { detectIntent } = require('../src/services/intentService')
const { resolveTriggerAt } = require('../src/services/reminderService')
const {
  formatReminderUpdateConfirmation
} = require('../src/controllers/reminderController')

const originalTriggerAt = new Date('2026-06-01T04:30:00.000Z')

function updatedIso(message) {
  return resolveTriggerAt(
    detectIntent(message).entities.date,
    originalTriggerAt
  ).toISOString()
}

assert.equal(
  updatedIso('change to 9 AM'),
  '2026-06-01T03:30:00.000Z',
  'change to 9 AM should update same reminder day to 9 AM IST'
)

assert.equal(
  updatedIso('change to 6 PM'),
  '2026-06-01T12:30:00.000Z',
  'change to 6 PM should update same reminder day to 6 PM IST'
)

assert.equal(
  updatedIso('change to 7:30 PM'),
  '2026-06-01T14:00:00.000Z',
  'change to 7:30 PM should preserve minutes'
)

assert.equal(
  formatReminderUpdateConfirmation(
    {
      message: 'Exercise',
      triggerAt: '2026-06-01T03:30:00.000Z'
    },
    new Date('2026-05-31T18:25:00.000Z')
  ),
`✅ Reminder updated

Exercise

📅 Tomorrow
⏰ 9:00 AM IST

This reminder will be sent once.`
)

console.log('Reminder update tests passed: 4')
