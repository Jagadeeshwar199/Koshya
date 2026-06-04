#!/usr/bin/env node
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'false'
process.env.AI_INTENT_ENABLED = 'false'

const assert = require('node:assert/strict')
const { detectAndPlan } = require('../src/detection/detectionEngine')
const { Decision } = require('../src/detection/types')
const { INTENTS } = require('../src/services/intentService')

const REMIND_CLARIFY = /When should I remind you/i

;(async () => {
  for (const msg of ['Hi', 'Hello', 'Thanks', 'How are you']) {
    const det = await detectAndPlan(msg)
    assert.ok(!REMIND_CLARIFY.test(det.clarification || ''), `${msg} must not ask reminder clarify`)
    assert.notEqual(det.decision, Decision.CLARIFY, `${msg} should not CLARIFY`)
    if (msg === 'Hi' || msg === 'Hello' || msg === 'Thanks' || msg === 'How are you') {
      assert.equal(det.intent.intent, INTENTS.HELP, msg)
    }
  }
  console.log('Weak intent guard tests passed: 4')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
