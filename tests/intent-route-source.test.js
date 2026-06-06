#!/usr/bin/env node
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'false'
process.env.AI_INTENT_ENABLED = 'true'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const assert = require('node:assert/strict')
let aiCalls = 0
require.cache[require.resolve('../src/services/aiIntentParser')] = {
  exports: {
    parseWithAI: async ({ rawMessage }) => {
      aiCalls++
      return {
        success: true,
        ai_intent: 'REMINDER_CREATE',
        confidence: 0.92,
        entities: { actionText: 'reminder', time: '06:00' },
        userResponse: '✓ Reminder set',
        model: 'gemini-2.5-flash',
        prompt_sent: 'p',
        ai_response: '{}'
      }
    }
  }
}

const { detectAndPlan } = require('../src/detection/detectionEngine')
const { RouteSource } = require('../src/detection/intentRouting')

;(async () => {
  aiCalls = 0
  for (const msg of ['Sorry 6 am', 'Actually tomorrow', 'Move it to Friday']) {
    const d = await detectAndPlan(msg)
    assert.equal(d.route_source, RouteSource.GEMINI, msg)
  }
  assert.equal(aiCalls, 3)

  aiCalls = 0
  for (const msg of ['Show subscriptions', 'Netflix renews on 27th every month - 149']) {
    const d = await detectAndPlan(msg)
    assert.equal(d.route_source, RouteSource.RULE, msg)
  }
  assert.equal(aiCalls, 0)
  console.log('Intent route source tests passed: 5')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
