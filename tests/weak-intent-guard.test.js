#!/usr/bin/env node
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'false'
process.env.AI_INTENT_ENABLED = 'false'

const assert = require('node:assert/strict')
const { Domain, Action, Decision } = require('../src/detection/types')
const { detectAndPlan } = require('../src/detection/detectionEngine')
const { INTENTS } = require('../src/services/intentService')

const REMIND_CLARIFY = /When should I remind you|subscription|remind you about/i
const BLOCKED = [INTENTS.REMINDER_CREATE, INTENTS.SUBSCRIPTION_CREATE]

const HELP_MSGS = [
  'Hi',
  'Hello',
  'Hey',
  'Good morning',
  'Thanks',
  'Thank you',
  'How are you',
  'Help',
  'What can you do?'
]

const TEST_HELP = ['Hi', 'Hello', 'Thanks', 'What can you do?', 'Good morning']

;(async () => {
  for (const msg of HELP_MSGS) {
    const det = await detectAndPlan(msg)
    assert.equal(det.domain, Domain.GENERAL, msg)
    assert.equal(det.action, Action.HELP, msg)
    assert.equal(det.winner, 'GENERAL:HELP', msg)
    assert.equal(det.decision, Decision.EXECUTE, msg)
    assert.equal(det.intent.intent, INTENTS.HELP, msg)
    assert.ok(!REMIND_CLARIFY.test(det.clarification || ''), msg)
    assert.ok(!BLOCKED.includes(det.intent.intent), msg)
  }
  for (const msg of TEST_HELP) {
    const det = await detectAndPlan(msg)
    assert.equal(`${det.domain}:${det.action}`, 'GENERAL:HELP', msg)
  }
  const weak = await detectAndPlan('hm')
  assert.equal(weak.decision, Decision.REJECTED_LOW_SCORE)
  assert.equal(weak.rejectionLog?.decision, Decision.REJECTED_LOW_SCORE)
  assert.equal(weak.rejectionLog?.score, 20)
  console.log(`Weak intent guard tests passed: ${HELP_MSGS.length + 1}`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
