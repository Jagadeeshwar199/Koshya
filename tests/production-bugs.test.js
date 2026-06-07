#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'true'

const stateByPhone = {}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: {
    getState: async (phone) => stateByPhone[phone] || null,
    setState: async (phone, patch) => {
      stateByPhone[phone] = { ...(stateByPhone[phone] || {}), ...patch }
    },
    clearState: async (phone) => {
      delete stateByPhone[phone]
    }
  }
}
require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async () => ({ success: true }),
    setOutboundCapture: () => {},
    clearOutboundCapture: () => {},
    setActiveReplyMessageId: () => {},
    clearActiveReplyMessageId: () => {}
  }
}
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...require('../src/services/reminderService'),
    updateReminderFromIntent: async ({ reminderId }) => ({
      id: reminderId,
      message: 'Exercise',
      triggerAt: '2026-06-01T00:30:00.000Z',
      status: 'pending'
    }),
    updateLatestReminderFromIntent: async () => null
  }
}

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { isCorrectionEntityName } = require('../src/intent/entityExtractor')
const { coerceIntentForLastEntity } = require('../src/services/entityUpdateCoercion')
const { buildKoshyaResponse } = require('../src/services/koshyaResponseLayer')
const { routeDetectedIntent } = require('../src/services/messageRouterService')

const phone = '919999999999'
stateByPhone[phone] = {
  last_entity_id: '123',
  last_entity_type: 'reminder',
  last_action: 'CREATE',
  last_entity_title: 'Exercise',
  last_entity_time: 'Tomorrow · 7:00 AM'
}

;(async () => {
  for (const msg of ['sorry 6 AM', 'Actually tomorrow', 'move it to Friday']) {
    const rule = detectIntent(msg)
    assert.ok(!isCorrectionEntityName(rule.entities.serviceName), msg)
    const coerced = await coerceIntentForLastEntity(phone, rule, msg)
    assert.equal(coerced.intent, INTENTS.REMINDER_RESCHEDULE, msg)
    assert.equal(coerced.lastEntityId, '123', msg)
    assert.equal(coerced.execution_intent, INTENTS.REMINDER_RESCHEDULE, msg)
    assert.equal(coerced.ai_intent, 'UPDATE_REMINDER', msg)
    const routed = await routeDetectedIntent(phone, msg, rule)
    assert.equal(routed.intent, INTENTS.REMINDER_RESCHEDULE, msg)
  }

  assert.equal(detectIntent('Actually tomorrow').entities.serviceName, undefined)

  const createReply = buildKoshyaResponse({
    intent: INTENTS.REMINDER_RESCHEDULE,
    entities: {},
    geminiRaw: null,
    execResult: {
      ok: true,
      intent: INTENTS.REMINDER_CREATE,
      reminder: { message: 'Exercise', triggerAt: '2026-06-01T04:30:00.000Z' }
    },
    validationOk: true
  })
  assert.match(createReply.text, /Reminder set/)

  const updateReply = buildKoshyaResponse({
    intent: INTENTS.REMINDER_CREATE,
    entities: {},
    geminiRaw: null,
    execResult: {
      ok: true,
      intent: INTENTS.REMINDER_RESCHEDULE,
      reminder: { message: 'Exercise', triggerAt: '2026-06-01T00:30:00.000Z' }
    },
    validationOk: true
  })
  assert.match(updateReply.text, /Reminder updated/)

  console.log('Production bugfix tests passed: 3')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
