const assert = require('node:assert/strict')

process.env.TZ = 'UTC'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { detectIntent, needsExplicitTimePrompt } = require('../src/services/intentService')
const {
  resolveTriggerAt,
  extractReminderTitle
} = require('../src/services/reminderService')
const { formatReminderListTime } = require('../src/formatters/reminderFormatter')

const now = new Date('2026-06-02T14:00:00.000Z')

function offsetIso(text) {
  return resolveTriggerAt(detectIntent(text).entities.date, now).toISOString()
}

for (const n of [1, 2, 3, 8]) {
  const text = `remind me to drink water after ${n} minutes`
  assert.equal(needsExplicitTimePrompt(detectIntent(text).entities, text), false)
  const trigger = resolveTriggerAt(detectIntent(text).entities.date, now)
  assert.equal(
    trigger.getTime() - now.getTime(),
    n * 60 * 1000,
    `after ${n} minutes`
  )
}

const tomorrow8 = detectIntent('remind me to pay rent tomorrow at 8 pm')
const t8 = resolveTriggerAt(tomorrow8.entities.date, now)
assert.equal(t8.toISOString(), '2026-06-03T14:30:00.000Z')

const row = {
  message: extractReminderTitle('remind me to drink water after 2 minutes'),
  triggerAt: offsetIso('remind me to drink water after 2 minutes')
}
assert.equal(
  formatReminderListTime(row.triggerAt, now),
  formatReminderListTime(resolveTriggerAt(detectIntent('remind me to drink water after 2 minutes').entities.date, now).toISOString(), now)
)

console.log('Reminder schedule tests passed: 6')
