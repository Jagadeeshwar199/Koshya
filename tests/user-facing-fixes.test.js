#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { parseDeleteAll } = require('../src/services/deleteFlowService')
const { parseFirst } = require('../src/services/parseFirstService')
const { parseMessage } = require('../src/services/parserCore')
const { extractReminderTitle, packReminderMessage, unpackReminderMessage } = require('../src/services/reminderService')
const { applyTypoFixes } = require('../src/utils/textUtils')

for (const typo of ['reinders', 'remiders', 'remidners', 'reminder', 'reminders']) {
  assert.equal(parseDeleteAll(`delete all ${typo}`), 'all_reminders', typo)
}

const titles = [
  ['Remind me after 20 min to go to tvs showroom', 'Go To Tvs Showroom'],
  ['Remind me after 30 min to call mom', 'Call Mom'],
  ['Remind me in 2 hours to pay rent', 'Pay Rent'],
  ['Remind me tomorrow to buy milk', 'Buy Milk'],
  ['Remind me every day to take vitamins', 'Take Vitamins'],
  ['Remind me everyday to take vitamins', 'Take Vitamins']
]
for (const [msg, want] of titles) {
  assert.equal(parseFirst(msg).taskText, want, msg)
  assert.match(extractReminderTitle(msg), new RegExp(want.replace(/\s+/g, '.*'), 'i'), msg)
}

for (const msg of ['Remind me every day to take vitamins', 'Remind me everyday to take vitamins', 'Remind me daily to take vitamins']) {
  const normalized = applyTypoFixes(msg)
  assert.match(normalized, /every day|daily/i, msg)
  assert.equal(parseFirst(msg).scheduleText, 'Every day')
  const packed = packReminderMessage('Take Vitamins', { daily: /\b(?:daily|every\s+day|everyday)\b/i.test(normalized) })
  assert.ok(unpackReminderMessage(packed).daily, msg)
}

const subs = [
  'Prime renews at 27th june every month',
  '27th June every month Prime',
  'June 27 every month Prime',
  '27 June every month Prime'
]
for (const msg of subs) {
  const parsed = parseMessage(msg)
  assert.equal(parsed.success, true, msg)
  assert.equal(parsed.serviceName, 'Prime', msg)
  assert.equal(parsed.recurrence, 'monthly', msg)
  assert.equal(parsed.renewalDay, 27, msg)
  assert.equal(parseFirst(msg).taskText, 'Prime', msg)
}

console.log('User-facing fixes tests passed:', titles.length + subs.length + 5)
