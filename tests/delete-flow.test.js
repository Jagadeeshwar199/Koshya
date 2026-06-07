#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const sent = []
let state = null
let cancelled = []
let archived = []

require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async (_s, body) => {
      sent.push(body)
      return { success: true }
    }
  }
}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: {
    getState: async () => state,
    setState: async (_p, s) => {
      state = s
    },
    clearState: async () => {
      state = null
    }
  }
}
const realReminder = require('../src/services/reminderService')
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...realReminder,
    getActiveReminders: async () => [
      {
        id: 'r1',
        message: realReminder.packReminderMessage('Sleep'),
        triggerAt: new Date(Date.now() + 86400000).toISOString()
      },
      {
        id: 'r2',
        message: realReminder.packReminderMessage('Rent'),
        triggerAt: new Date(Date.now() + 86400000).toISOString()
      }
    ],
    cancelReminder: async (id) => {
      cancelled.push(id)
      return { id, message: realReminder.packReminderMessage(id === 'r1' ? 'Sleep' : 'Rent') }
    }
  }
}
require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => [
      { id: 's1', serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }
    ],
    archiveSubscription: async (id) => {
      archived.push(id)
      return { serviceName: 'Netflix' }
    }
  }
}

const {
  tryStartDeleteFlow,
  handleDeleteMenuReply,
  handleDeletePickReply,
  handlePendingDeleteReply
} = require('../src/services/deleteFlowService')

async function run() {
  state = null
  sent.length = 0
  await tryStartDeleteFlow('919999999999', 'Delete something')
  assert.equal(state.action, 'delete_menu')
  assert.match(sent.at(-1), /1\. Reminder/)

  sent.length = 0
  await handleDeleteMenuReply('919999999999', '1')
  assert.equal(state.action, 'delete_pick')
  assert.match(sent.at(-1), /1\. Sleep/)
  assert.match(sent.at(-1), /Delete all/)

  sent.length = 0
  cancelled.length = 0
  await handleDeletePickReply('919999999999', 'Delete 1', state)
  assert.deepEqual(cancelled, ['r1'])
  assert.equal(state, null)

  state = null
  sent.length = 0
  await tryStartDeleteFlow('919999999999', 'Delete all reminders')
  assert.equal(state.action, 'pending_delete')
  assert.equal(state.delete_scope, 'all_reminders')
  assert.match(sent.at(-1), /DELETE ALL/)

  sent.length = 0
  await handlePendingDeleteReply('919999999999', 'yes', state)
  assert.match(sent.at(-1), /DELETE ALL/)

  sent.length = 0
  await handlePendingDeleteReply('919999999999', 'DELETE ALL', state)
  assert.match(sent.at(-1), /Nothing deleted yet/)
  assert.equal(state, null)

  state = null
  sent.length = 0
  await tryStartDeleteFlow('919999999999', 'Delete all subscriptions')
  assert.equal(state.delete_scope, 'all_subscriptions')

  state = null
  sent.length = 0
  await tryStartDeleteFlow('919999999999', 'Delete everything')
  assert.equal(state.delete_scope, 'everything')

  state = { action: 'delete_pick', delete_list_type: 'reminders', delete_targets: [{ type: 'reminder', id: 'r1' }], pending_at: new Date().toISOString() }
  sent.length = 0
  await handleDeletePickReply('919999999999', 'Delete all', state)
  assert.equal(state.action, 'pending_delete')
  assert.equal(state.delete_scope, 'all_reminders')

  console.log('Delete flow tests passed: 8')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
