#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'true'

const { parseFirst, classifyItemType } = require('../src/services/parseFirstService')
const { formatGotIt } = require('../src/formatters/unifiedUxFormatter')
const { formatReminderConfirmation } = require('../src/formatters/reminderFormatter')
const { formatSubscriptionAdded } = require('../src/formatters/subscriptionFormatter')
const { INTENTS } = require('../src/services/intentService')

const fw = parseFirst('remind be to check FW channel every sunday 5pm')
assert.match(fw.taskText, /check fw channel/i)
assert.match(fw.scheduleText, /Every Sunday/i)
assert.match(fw.scheduleText, /5.*PM/i)
assert.equal(fw.itemType, 'REMINDER')

const bare = parseFirst('check FW channel every sunday 5pm')
assert.match(bare.taskText, /check fw channel/i)

const netflix = parseFirst('Netflix renews on 27th every month')
assert.equal(netflix.taskText, 'Netflix')
assert.match(netflix.scheduleText, /Every month on 27th/)
assert.equal(netflix.itemType, 'SUBSCRIPTION')

const rent = parseFirst('Pay rent on 1st every month')
assert.match(rent.taskText, /Pay rent/i)
assert.equal(rent.itemType, 'BILL')

const rule = parseFirst('Remind me tomorrow at 9 PM')
assert.ok(rule.ruleScore >= 0)
assert.equal(rule.escalatedToAi, rule.ruleScore < 90)

const kept = parseFirst('Show subscriptions', {
  success: true,
  ai_intent: INTENTS.UNKNOWN,
  confidence: 0.2
})
assert.notEqual(kept.finalIntent, INTENTS.UNKNOWN)

assert.match(
  formatGotIt('Netflix', 'Every month on 27th'),
  /^✅ Got it\n\nNetflix\nEvery month on 27th$/
)
assert.match(formatReminderConfirmation({ message: 'sleep', taskText: 'Sleep', scheduleText: 'Every Sunday · 5 PM' }), /Got it/)
assert.doesNotMatch(formatReminderConfirmation({ message: 'sleep', taskText: 'Sleep', scheduleText: 'Every Sunday · 5 PM' }), /Reminder set/)
assert.match(
  formatSubscriptionAdded({ serviceName: 'Netflix', taskText: 'Netflix', scheduleText: 'Every month on 27th' }),
  /Got it/
)
assert.doesNotMatch(
  formatSubscriptionAdded({ serviceName: 'Netflix', taskText: 'Netflix', scheduleText: 'Every month on 27th' }),
  /Subscription set/
)

console.log('Parse-first tests passed: 10')
