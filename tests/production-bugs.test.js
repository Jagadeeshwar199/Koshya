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
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined) delete stateByPhone[phone][k]
      }
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
const reminders = []
let updateCalls = 0
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...require('../src/services/reminderService'),
    updateReminderFromIntent: async ({ reminderId, entities }) => {
      updateCalls++
      return {
        id: reminderId,
        message: 'Exercise',
        triggerAt: '2026-06-02T00:30:00.000Z',
        status: 'pending'
      }
    },
    updateLatestReminderFromIntent: async () => null
  }
}

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { isCorrectionEntityName } = require('../src/intent/entityExtractor')
const { coerceIntentForLastEntity, CLARIFY_UPDATE } = require('../src/services/entityUpdateCoercion')
const { buildKoshyaResponse } = require('../src/services/koshyaResponseLayer')
const { routeDetectedIntent, routeWhatsAppMessage } = require('../src/services/messageRouterService')
const { handleClarifyUpdate } = require('../src/controllers/queryController')
const { isExecutablePendingOverrideIntent } = require('../src/intent/executableIntents')
const { getPendingConfirmation, PENDING_TTL_MS } = require('../src/services/pendingConfirmationService')

const phone = '919999999999'
stateByPhone[phone] = {
  last_entity_id: '123',
  last_entity_type: 'reminder',
  last_action: 'CREATE',
  last_entity_title: 'badminton',
  last_entity_time: 'Tomorrow · 7:00 AM'
}

;(async () => {
  for (const msg of ['sorry 6 AM', 'move it to Friday']) {
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

  for (const msg of ['tomorrow', 'Friday', 'next week', 'actually tomorrow', 'actually Friday']) {
    const rule = detectIntent(msg)
    const coerced = await coerceIntentForLastEntity(phone, rule, msg)
    assert.equal(coerced.intent, CLARIFY_UPDATE, msg)
    assert.match(coerced.clarificationText, /Do you want to update your badminton reminder\?/i, msg)
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

  updateCalls = 0
  stateByPhone[phone] = {
    last_entity_id: '123',
    last_entity_type: 'reminder',
    last_action: 'CREATE',
    last_entity_title: 'badminton',
    last_entity_time: 'Tomorrow · 7:00 AM'
  }
  const ambiguous = await coerceIntentForLastEntity(phone, detectIntent('actually tomorrow'), 'actually tomorrow')
  assert.equal(ambiguous.intent, CLARIFY_UPDATE)
  await handleClarifyUpdate(phone, ambiguous)
  assert.equal(stateByPhone[phone].pending_action, true)
  assert.equal(stateByPhone[phone].pending_intent, INTENTS.REMINDER_RESCHEDULE)
  assert.equal(stateByPhone[phone].target_id, '123')
  assert.ok(stateByPhone[phone].proposed_changes?.date)

  for (const msg of ['yes', 'ok', 'tomorrow']) {
    await handleClarifyUpdate(phone, ambiguous)
    const result = await routeWhatsAppMessage(phone, msg)
    assert.equal(result.intent, INTENTS.REMINDER_RESCHEDULE, msg)
    assert.equal(updateCalls, 1, msg)
    assert.equal(stateByPhone[phone].pending_action, undefined, msg)
    updateCalls = 0
  }

  await handleClarifyUpdate(phone, ambiguous)
  const subIntent = detectIntent('Netflix renews on 27th every month - 149')
  assert.ok(isExecutablePendingOverrideIntent(subIntent))
  const subResult = await routeWhatsAppMessage(phone, 'Netflix renews on 27th every month - 149')
  assert.equal(subResult.intent, INTENTS.SUBSCRIPTION_CREATE)
  assert.equal(updateCalls, 0)
  assert.equal(stateByPhone[phone].pending_action, undefined)

  await handleClarifyUpdate(phone, ambiguous)
  await routeWhatsAppMessage(phone, 'no')
  assert.equal(updateCalls, 0)
  assert.equal(stateByPhone[phone].pending_action, undefined)

  await handleClarifyUpdate(phone, ambiguous)
  stateByPhone[phone].pending_at = new Date(Date.now() - PENDING_TTL_MS - 1000).toISOString()
  assert.equal(await getPendingConfirmation(phone), null)

  console.log('Production bugfix tests passed: 5')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
