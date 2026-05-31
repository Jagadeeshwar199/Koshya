const assert = require('node:assert/strict')

let subscriptionCalls = 0
let reminderQueryCalls = 0
let reminderCreateCalls = 0

require.cache[require.resolve('../services/subscriptionFlowService')] = {
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

  console.log('Intent router tests passed: 5')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
