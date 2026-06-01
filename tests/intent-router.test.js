const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

let subscriptionCalls = 0
let reminderQueryCalls = 0
let reminderCreateCalls = 0
let reminderUpdateCalls = 0
let reminderCancelCalls = 0
let subscriptionDeleteCalls = 0

require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: {
    getState: async () => null,
    setState: async () => {},
    clearState: async () => {}
  }
}

require.cache[require.resolve('../src/services/subscriptionFlowService')] = {
  exports: {
    handleSubscriptionMessage: async () => {
      subscriptionCalls++
      return { ok: true, handledBy: 'subscription' }
    }
  }
}

require.cache[require.resolve('../src/controllers/reminderController')] = {
  exports: {
    handleReminderCreateIntent: async () => {
      reminderCreateCalls++
      return { ok: true, intent: 'REMINDER_CREATE' }
    },
    handleReminderCancelIntent: async () => {
      reminderCancelCalls++
      return { ok: true, intent: 'REMINDER_CANCEL' }
    },
    handleReminderUpdateIntent: async () => {
      reminderUpdateCalls++
      return { ok: true, intent: 'REMINDER_UPDATE' }
    },
    handleReminderQueryIntent: async () => {
      reminderQueryCalls++
      return { ok: true, intent: 'REMINDER_QUERY' }
    }
  }
}

require.cache[require.resolve('../src/controllers/queryController')] = {
  exports: {
    handleSubscriptionQueryIntent: async () => ({ ok: true, intent: 'SUBSCRIPTION_QUERY' }),
    handleSubscriptionUpdateIntent: async () => ({ ok: true, intent: 'SUBSCRIPTION_UPDATE' }),
    handleSubscriptionDeleteIntent: async () => {
      subscriptionDeleteCalls++
      return { ok: true, intent: 'SUBSCRIPTION_DELETE' }
    },
    handleHelpIntent: async () => ({ ok: true, intent: 'HELP' }),
    handleUnknownIntent: async () => ({ ok: true, intent: 'UNKNOWN' })
  }
}

const { routeWhatsAppMessage } = require('../src/services/messageRouterService')

async function run() {
  await routeWhatsAppMessage('919999999999', 'Netflix renewal tomorrow')
  await routeWhatsAppMessage('919999999999', 'Tell me about an existing Netflix reminder')
  await routeWhatsAppMessage('919999999999', 'What renews tomorrow?')

  assert.equal(subscriptionCalls, 0, 'reminder query messages must not call subscription parser flow')
  assert.equal(reminderQueryCalls, 3, 'bug messages should route to reminder query')

  await routeWhatsAppMessage('919999999999', 'Netflix renews on 27th every month - 149')
  assert.equal(subscriptionCalls, 1, 'subscription create should still call subscription parser flow')

  await routeWhatsAppMessage('919999999999', 'Remind me tomorrow about Netflix')
  assert.equal(reminderCreateCalls, 1, 'reminder create should route to reminder handler')

  await routeWhatsAppMessage('919999999999', 'change to 9 AM')
  assert.equal(reminderUpdateCalls, 1, 'reminder update should route to reminder update handler')

  await routeWhatsAppMessage('919999999999', 'cancel exercise reminder')
  assert.equal(reminderCancelCalls, 1, 'reminder cancel should route to reminder cancel handler')

  await routeWhatsAppMessage('919999999999', 'remove Netflix subscription')
  assert.equal(subscriptionDeleteCalls, 1, 'subscription delete should route to subscription delete handler')

  console.log('Intent router tests passed: 8')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
