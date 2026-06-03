const assert = require('node:assert/strict')
const { detectIntent, INTENTS, MIN_CONFIDENCE } = require('../src/services/intentService')
const examples = require('./fixtures/user-intent-examples')

function entityType(intent) {
  if (
    intent === INTENTS.SUBSCRIPTION_CREATE ||
    intent === INTENTS.SUBSCRIPTION_UPDATE ||
    intent === INTENTS.SUBSCRIPTION_DELETE ||
    intent === INTENTS.SUBSCRIPTION_QUERY ||
    intent === INTENTS.SUBSCRIPTION_EXPIRY
  ) {
    return 'subscription'
  }
  if (
    intent === INTENTS.REMINDER_CREATE ||
    intent === INTENTS.REMINDER_UPDATE ||
    intent === INTENTS.REMINDER_RESCHEDULE ||
    intent === INTENTS.REMINDER_CANCEL ||
    intent === INTENTS.REMINDER_QUERY
  ) {
    return 'reminder'
  }
  return null
}

function assertExpect(message, result, expect) {
  if (expect.clarify) {
    assert.equal(result.entities.clarify, expect.clarify, `${message}: clarify`)
  }
  if (expect.queryType) {
    assert.equal(result.entities.queryType, expect.queryType, `${message}: queryType`)
  }
  if (expect.serviceName) {
    assert.ok(
      result.entities.serviceName &&
        result.entities.serviceName.toLowerCase().includes(expect.serviceName.toLowerCase()),
      `${message}: service expected ${expect.serviceName}, got ${result.entities.serviceName}`
    )
  }
  if (expect.hasDate) {
    assert.ok(result.entities.date, `${message}: expected date`)
  }
  if (expect.hasRecurrence) {
    assert.ok(result.entities.recurrence, `${message}: expected recurrence`)
  }
  if (expect.hasAmount) {
    assert.ok(result.entities.amount, `${message}: expected amount`)
  }
  if (expect.actionContains) {
    const action = (result.entities.actionText || '').toLowerCase()
    assert.ok(
      action.includes(expect.actionContains.toLowerCase()),
      `${message}: action expected "${expect.actionContains}", got "${result.entities.actionText}"`
    )
  }
  if (expect.entityType) {
    assert.equal(entityType(result.intent), expect.entityType, `${message}: entity type`)
  }
}

const all = examples.all()
let passed = 0

for (const { message, intent: expected, expect } of all) {
  const result = detectIntent(message)
  assert.equal(
    result.intent,
    expected,
    `${message} => ${result.intent} (${result.confidence}), expected ${expected}`
  )
  if (expected !== INTENTS.UNKNOWN) {
    assert.ok(result.confidence >= MIN_CONFIDENCE, `${message}: confidence ${result.confidence}`)
  }
  assert.ok(result.rawText, `${message}: rawText`)
  if (expect) {
    assertExpect(message, result, expect)
  }
  passed++
}

console.log(`User intent examples passed: ${passed}/${all.length}`)
