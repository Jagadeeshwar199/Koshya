#!/usr/bin/env node
process.env.TZ = 'UTC'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'true'

const assert = require('node:assert/strict')

const stateByPhone = {}
const reminders = []
const subscriptions = []

require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async () => ({ success: true }),
    setOutboundCapture: () => {},
    clearOutboundCapture: () => {},
    setActiveReplyMessageId: () => {},
    clearActiveReplyMessageId: () => {}
  }
}
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
require.cache[require.resolve('../src/services/pendingSubscriptionService')] = {
  exports: {
    getPending: async () => null,
    setPending: async () => {},
    clearPending: async () => {}
  }
}

const realReminder = require('../src/services/reminderService')
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...realReminder,
    createReminderFromIntent: async ({ message, entities }) => {
      const row = {
        id: '123',
        message: realReminder.packReminderMessage(
          realReminder.extractReminderTitle(message, entities.serviceName),
          { daily: /\b(?:daily|every\s+day)\b/i.test(message) }
        ),
        triggerAt: realReminder.resolveTriggerAt(entities.date).toISOString(),
        status: 'pending'
      }
      reminders.length = 0
      reminders.push(row)
      return row
    },
    updateReminderFromIntent: async ({ reminderId, entities }) => {
      const row = reminders.find((r) => r.id === reminderId && r.status === 'pending')
      if (!row || !entities.date) return null
      row.triggerAt = realReminder
        .resolveTriggerAt(entities.date, new Date(row.triggerAt))
        .toISOString()
      return { ...row }
    },
    updateLatestReminderFromIntent: async ({ entities }) => {
      const row = reminders.filter((r) => r.status === 'pending').slice(-1)[0]
      if (!row) return null
      return require('../src/services/reminderService').updateReminderFromIntent({
        reminderId: row.id,
        entities
      })
    },
    getActiveReminders: async () => reminders.filter((r) => r.status === 'pending'),
    getUserReminders: async () => reminders.filter((r) => r.status === 'pending'),
    getLatestActiveReminder: async () => reminders.filter((r) => r.status === 'pending').slice(-1)[0] || null
  }
}

require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    createSubscriptionRecord: async (fields) => {
      const row = { id: 'sub-1', ...fields }
      subscriptions.length = 0
      subscriptions.push(row)
      return row
    },
    updateSubscription: async (id, updates) => {
      const row = subscriptions.find((s) => s.id === id)
      assert.ok(row, 'subscription row must exist')
      Object.assign(row, updates)
      return { ...row }
    },
    getUserSubscriptions: async () => [...subscriptions]
  }
}

require.cache[require.resolve('../src/observability/pipelineLogService')] = {
  exports: {
    logMessage: async () => null,
    logDetection: async () => {},
    logValidation: async () => {},
    logExecution: async () => {},
    logShadowDetection: async () => {},
    logSystemError: async () => {}
  }
}

const { routeDetectedIntent } = require('../src/services/messageRouterService')
const { detectIntent } = require('../src/services/intentService')
const { handleSubscriptionMessage } = require('../src/services/subscriptionFlowService')
const { parseMessage } = require('../src/services/parserService')

const phone = '919999999999'

async function runReminderFlow() {
  stateByPhone[phone] = {}
  reminders.length = 0

  const createIntent = detectIntent('remind me at 7 AM')
  assert.equal(createIntent.intent, 'REMINDER_CREATE')
  await routeDetectedIntent(phone, 'remind me at 7 AM', createIntent)
  assert.equal(reminders.length, 1)
  assert.equal(reminders[0].id, '123')
  assert.equal(stateByPhone[phone].last_entity_id, '123')
  assert.equal(stateByPhone[phone].last_entity_type, 'reminder')

  const updateIntent = detectIntent('sorry 6 AM')
  await routeDetectedIntent(phone, 'sorry 6 AM', updateIntent)

  assert.equal(reminders.length, 1, 'update must not create a row')
  assert.equal(reminders[0].id, '123')
  const updated = new Date(reminders[0].triggerAt)
  assert.equal(updated.getUTCHours(), 0)
  assert.equal(updated.getUTCMinutes(), 30, '6 AM IST')
}

async function runSubscriptionFlow() {
  stateByPhone[phone] = {}
  subscriptions.length = 0

  const parsed = parseMessage('Netflix renews on 27th every month - 149')
  assert.ok(parsed.success)
  await handleSubscriptionMessage(phone, 'Netflix renews on 27th every month - 149')
  assert.equal(subscriptions.length, 1)
  assert.equal(subscriptions[0].id, 'sub-1')
  assert.equal(subscriptions[0].renewalDay, 27)
  assert.equal(stateByPhone[phone].last_entity_id, 'sub-1')

  const updateIntent = detectIntent('change to 28th')
  await routeDetectedIntent(phone, 'change to 28th', updateIntent)

  assert.equal(subscriptions.length, 1, 'update must not create a row')
  assert.equal(subscriptions[0].id, 'sub-1')
  assert.equal(subscriptions[0].renewalDay, 28)
}

async function run() {
  await runReminderFlow()
  await runSubscriptionFlow()
  console.log('Entity update in-place tests passed: 2 flows')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
