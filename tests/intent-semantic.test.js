const assert = require('node:assert/strict')
const { detectIntent, INTENTS, MIN_CONFIDENCE } = require('../src/services/intentService')
const cases = require('./fixtures/intent-semantic-cases')

const allCases = cases.all()
assert.ok(allCases.length >= 200, `expected 200+ cases, got ${allCases.length}`)

let passed = 0
for (const [message, expected] of allCases) {
  const result = detectIntent(message)
  assert.equal(
    result.intent,
    expected,
    `${message} => ${result.intent} (${result.confidence}), expected ${expected}`
  )
  assert.ok(result.confidence >= 0 && result.confidence <= 1)
  if (expected !== INTENTS.UNKNOWN) {
    assert.ok(
      result.confidence >= MIN_CONFIDENCE || result.confidence >= 0.55,
      `${message} confidence ${result.confidence}`
    )
  }
  passed++
}

const expiry = detectIntent('Netflix ends tomorrow')
assert.equal(expiry.intent, INTENTS.SUBSCRIPTION_EXPIRY)
assert.equal(expiry.entities.queryType, 'expiry')
assert.equal(expiry.entities.serviceName, 'Netflix')

const implicit = detectIntent('Need to call mom tomorrow')
assert.equal(implicit.intent, INTENTS.REMINDER_CREATE)
assert.ok(implicit.entities.date)

const typo = detectIntent('remindar me to pay rent tomorrow')
assert.equal(typo.intent, INTENTS.REMINDER_CREATE)

console.log(`Intent semantic tests passed: ${passed} (+3 assertions), ${allCases.length} cases`)
