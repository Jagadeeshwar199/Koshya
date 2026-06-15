#!/usr/bin/env node
const assert = require('node:assert/strict')
const { sanitizeTaskText, isValidAmount, isValidMeridiemHour } = require('../src/utils/inputValidation')
const { extractEntities } = require('../src/intent/entityExtractor')
const { validateIntent } = require('../src/services/intentValidationService')
const { INTENTS } = require('../src/services/intentService')

assert.equal(sanitizeTaskText('  DROP `TABLE`  ').includes('DROP'), true)
assert.ok(!isValidAmount(999999999999))
assert.ok(isValidAmount(149))
assert.equal(isValidMeridiemHour(99), false)
assert.equal(extractEntities('cancel all reminders about gym').serviceName, null)
assert.equal(extractEntities('remind me at 99pm').date, null)

const badAmt = validateIntent(
  { intent: INTENTS.SUBSCRIPTION_CREATE, entities: { amount: 999999999999, serviceName: 'Netflix' } },
  'Netflix 999999999999'
)
assert.equal(badAmt.passed, false)

console.log('Input validation tests passed: 6')
