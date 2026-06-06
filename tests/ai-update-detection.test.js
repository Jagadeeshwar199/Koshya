#!/usr/bin/env node
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'false'
process.env.AI_INTENT_ENABLED = 'true'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const assert = require('node:assert/strict')

const conversationState = {
  last_entity_id: '123',
  last_entity_type: 'reminder',
  last_action: 'CREATE',
  last_entity_title: 'Exercise',
  last_entity_time: 'Tomorrow · 7:00 AM'
}

const { buildPrompt, parseWithAI } = require('../src/services/aiIntentParser')
const { attachLastEntityId } = require('../src/services/entityContextService')
const { INTENTS } = require('../src/services/intentService')

const prompt = buildPrompt('sorry 6 AM', 'sorry 6 am', { intent: 'UNKNOWN' }, conversationState)
assert.match(prompt, /conversation_state/)
assert.match(prompt, /sorry, actually, instead, change, move, or make it/i)
assert.match(prompt, /REMINDER_RESCHEDULE/)
assert.match(prompt, /123/)

assert.equal(
  attachLastEntityId({ intent: INTENTS.REMINDER_RESCHEDULE, entities: {} }, conversationState).lastEntityId,
  '123'
)

let captured = null
require.cache[require.resolve('../src/services/aiIntentParser')] = {
  exports: {
    buildPrompt,
    parseWithAI: async (args) => {
      captured = args
      return {
        success: true,
        ai_intent: INTENTS.REMINDER_RESCHEDULE,
        confidence: 0.91,
        entities: {},
        userResponse: '✓ Updated',
        model: 'gemini-2.5-flash',
        prompt_sent: 'p',
        ai_response: '{}'
      }
    }
  }
}
require.cache[require.resolve('../src/services/entityContextService')] = {
  exports: {
    getEntityContextForAI: async () => conversationState,
    attachLastEntityId
  }
}

const { detectAndPlan } = require('../src/detection/detectionEngine')
const { RouteSource } = require('../src/detection/intentRouting')

;(async () => {
  for (const msg of ['Sorry 6 am', 'Actually tomorrow', 'Move it to Friday']) {
    const det = await detectAndPlan(msg, {
      userId: '919999999999',
      rawMessage: msg,
      normalized: msg.toLowerCase()
    })
    assert.equal(det.route_source, RouteSource.GEMINI, msg)
    assert.equal(det.intent.intent, INTENTS.REMINDER_RESCHEDULE, msg)
    assert.equal(det.intent.lastEntityId, '123', msg)
  }

  assert.ok(captured?.conversationState)
  assert.equal(captured.conversationState.last_entity_id, '123')
  console.log('AI update detection tests passed: 4')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
