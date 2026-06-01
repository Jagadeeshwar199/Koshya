const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

let updateCall = null
const sent = []

require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => [
      {
        id: 'sub-1',
        serviceName: 'Netflix',
        amount: 149,
        renewalDay: 27,
        renewalMonth: null,
        recurrence: 'monthly'
      }
    ],
    updateSubscription: async (id, updates) => {
      updateCall = { id, updates }
      return {
        id,
        serviceName: 'Netflix',
        amount: updates.amount,
        renewalDay: 27,
        renewalMonth: null,
        recurrence: 'monthly'
      }
    },
    resolveSubscriptionDelete: async () => ({ status: 'not_found' })
  }
}

require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async (to, body) => {
      sent.push({ to, body })
      return { success: true }
    }
  }
}

require.cache[require.resolve('../src/controllers/paginationController')] = {
  exports: {
    PAGE_SIZE: 5
  }
}

const {
  handleSubscriptionUpdateIntent
} = require('../src/controllers/queryController')

async function run() {
  const result = await handleSubscriptionUpdateIntent('919999999999', {
    intent: 'SUBSCRIPTION_UPDATE',
    entities: {
      serviceName: 'Netflix',
      amount: 199
    }
  })

  assert.equal(result.ok, true)
  assert.equal(result.subscription.amount, 199)
  assert.deepEqual(updateCall, {
    id: 'sub-1',
    updates: { amount: 199 }
  })
  assert.match(sent[0].body, /Updated/)
  assert.match(sent[0].body, /Netflix/)
  assert.match(sent[0].body, /199/)

  console.log('Subscription update intent tests passed: 6')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
