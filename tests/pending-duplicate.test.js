#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'true'

const stateByPhone = {}
const reminders = []
let createCalls = 0
let updateCalls = 0

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
const realReminder = require('../src/services/reminderService')
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...realReminder,
    createReminderFromIntent: async ({ parseMeta }) => {
      createCalls++
      const row = {
        id: `r${createCalls}`,
        message: realReminder.packReminderMessage(parseMeta?.taskText || 'Task'),
        triggerAt: new Date().toISOString(),
        taskText: parseMeta?.taskText,
        scheduleText: parseMeta?.scheduleText
      }
      reminders.push(row)
      return row
    },
    updateReminderFromIntent: async () => {
      updateCalls++
      return reminders[0]
    },
    updateLatestReminderFromIntent: async () => null
  }
}

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { coerceIntentForLastEntity, CLARIFY_UPDATE, isSameReminderSignature } = require('../src/services/entityUpdateCoercion')
const { parseFirst } = require('../src/services/parseFirstService')
const { routeWhatsAppMessage } = require('../src/services/messageRouterService')
const { handleClarifyUpdate } = require('../src/controllers/queryController')

const phone = '919999999999'

function setLastFw() {
  stateByPhone[phone] = {
    last_entity_id: 'r1',
    last_entity_type: 'reminder',
    last_action: 'CREATE',
    last_entity_title: 'Fw channel',
    last_entity_time: 'Every Sunday · 5 PM'
  }
}

;(async () => {
  setLastFw()
  const youtube = detectIntent('youtube channel every sunday 5pm')
  const coerced = await coerceIntentForLastEntity(phone, youtube, 'youtube channel every sunday 5pm')
  assert.notEqual(coerced.intent, CLARIFY_UPDATE)
  assert.equal(coerced.intent, INTENTS.REMINDER_CREATE)

  createCalls = 0
  setLastFw()
  await routeWhatsAppMessage(phone, 'youtube channel every sunday 5pm')
  assert.equal(createCalls, 1)
  assert.equal(updateCalls, 0)
  assert.equal(reminders.length, 1)

  setLastFw()
  const dup = detectIntent('FW channel every sunday 5pm')
  const dupCoerced = await coerceIntentForLastEntity(phone, dup, 'FW channel every sunday 5pm')
  assert.equal(dupCoerced.intent, CLARIFY_UPDATE)
  assert.ok(
    isSameReminderSignature(
      { title: 'Fw channel', time: 'Every Sunday · 5 PM' },
      parseFirst('FW channel every sunday 5pm')
    )
  )

  updateCalls = 0
  createCalls = reminders.length
  await handleClarifyUpdate(phone, dupCoerced)
  assert.equal(stateByPhone[phone].pending_action, true)

  const beforeHi = createCalls
  await routeWhatsAppMessage(phone, 'hi')
  assert.equal(stateByPhone[phone].pending_action, undefined)
  assert.equal(updateCalls, 0)
  assert.equal(createCalls, beforeHi)

  setLastFw()
  await handleClarifyUpdate(phone, dupCoerced)
  const beforeNew = createCalls
  await routeWhatsAppMessage(phone, 'youtube channel every sunday 5pm')
  assert.equal(stateByPhone[phone].pending_action, undefined)
  assert.equal(updateCalls, 0)
  assert.equal(createCalls, beforeNew + 1)

  console.log('Pending duplicate tests passed: 5')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
