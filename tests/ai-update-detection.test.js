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

const { buildPrompt } = require('../src/services/aiIntentParser')
const { attachLastEntityId } = require('../src/services/entityContextService')
const { INTENTS } = require('../src/services/intentService')

const prompt = buildPrompt('sorry 6 AM', 'sorry 6 am', { intent: 'UNKNOWN' }, conversationState)
assert.match(prompt, /last_entity_id: 123/)
assert.match(prompt, /last_entity_type: reminder/)
assert.match(prompt, /last_entity_title: Exercise/)
assert.match(prompt, /last_entity_time: Tomorrow · 7:00 AM/)
assert.match(prompt, /UPDATE_REMINDER/)

assert.equal(
  attachLastEntityId({ intent: INTENTS.REMINDER_RESCHEDULE, entities: {} }, conversationState).lastEntityId,
  '123'
)

let captured = null
require.cache[require.resolve('../src/services/aiIntentParser')] = {
  exports: {
    buildPrompt,
    MODEL: 'gemini-2.5-flash',
    parseWithAI: async (args) => {
      captured = args
      const promptSent = buildPrompt(args.rawMessage, args.normalized, args.deterministic, args.conversationState)
      return {
        success: true,
        ai_intent: INTENTS.REMINDER_RESCHEDULE,
        raw_ai_intent: 'UPDATE_REMINDER',
        confidence: 0.91,
        entities: {},
        userResponse: '✓ Updated',
        model: 'gemini-2.5-flash',
        prompt_sent: promptSent,
        ai_response: '{"intent":"UPDATE_REMINDER"}'
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
    assert.equal(det.pendingLearning.ai_intent, 'UPDATE_REMINDER', msg)
    assert.ok(String(det.pendingLearning.prompt_sent || '').includes('last_entity_id: 123'), msg)
    assert.equal(det.pendingLearning.model, 'gemini-2.5-flash', msg)
    assert.ok(det.pendingLearning.ai_response, msg)
  }

  assert.ok(captured?.conversationState)
  assert.equal(captured.conversationState.last_entity_id, '123')
  console.log('AI update detection tests passed: 4')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
