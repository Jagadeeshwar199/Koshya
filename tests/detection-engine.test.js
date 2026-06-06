#!/usr/bin/env node
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'false'
process.env.AI_INTENT_ENABLED = 'false'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const assert = require('node:assert/strict')
const { Domain, Action, Decision } = require('../src/detection/types')
const { detectAndPlan, runDetection } = require('../src/detection/detectionEngine')
const { getAnalytics, resetAnalytics } = require('../src/services/detectionAnalyticsService')
const { INTENTS } = require('../src/services/intentService')

resetAnalytics()

async function run() {
  const r1 = await detectAndPlan('Remind me tomorrow at 9 AM about rent')
  assert.equal(r1.domain, Domain.REMINDER)
  assert.equal(r1.action, Action.CREATE)
  assert.equal(r1.intent.intent, INTENTS.REMINDER_CREATE)
  assert.equal(r1.decision, Decision.EXECUTE)

  const r2 = await detectAndPlan('delete my gym reminder')
  assert.equal(r2.action, Action.DELETE)
  assert.equal(r2.intent.intent, INTENTS.REMINDER_CANCEL)

  const r3 = await detectAndPlan('show my reminders')
  assert.equal(r3.intent.intent, INTENTS.REMINDER_QUERY)

  const r4 = await detectAndPlan('Netflix renews on 27th every month - 149')
  assert.equal(r4.domain, Domain.SUBSCRIPTION)
  assert.equal(r4.intent.intent, INTENTS.SUBSCRIPTION_CREATE)

  const r5 = await detectAndPlan('remove Netflix subscription')
  assert.equal(r5.intent.intent, INTENTS.SUBSCRIPTION_DELETE)

  const r6 = await detectAndPlan('show my subscriptions')
  assert.equal(r6.intent.intent, INTENTS.SUBSCRIPTION_QUERY)

  const amb = runDetection('Netflix')
  assert.equal(amb.decision, Decision.AI_FALLBACK)

  process.env.AI_INTENT_ENABLED = 'false'
  const unk = await detectAndPlan('xyzzy qwerty')
  assert.ok(
    [Decision.AI_FALLBACK, Decision.CLARIFY, Decision.REJECTED_LOW_SCORE].includes(unk.decision)
  )

  const stats = getAnalytics()
  assert.ok(stats.execution_count >= 1)

  const ai = await detectAndPlan('asdfghjkl qwerty uiop')
  assert.ok(
    [Decision.AI_FALLBACK, Decision.CLARIFY, Decision.REJECTED_LOW_SCORE].includes(ai.decision)
  )

  console.log('Detection engine tests passed: 10')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
