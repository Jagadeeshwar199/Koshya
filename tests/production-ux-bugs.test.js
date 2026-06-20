#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = 'true'

let subs = []
let created = 0
require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => subs,
    createSubscriptionRecord: async (fields) => {
      created++
      const row = { id: `sub-${created}`, ...fields, active: true, renewalDay: fields.renewalDay, renewalMonth: fields.renewalMonth, recurrence: fields.recurrence }
      subs.push(row)
      return row
    }
  }
}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: { getState: async () => null, setState: async () => {}, clearState: async () => {} }
}
require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: { sendWhatsAppMessage: async () => ({ success: true }) }
}

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { handleSubscriptionQueryIntent, handleHelpIntent } = require('../src/controllers/queryController')
const { handleSubscriptionMessage } = require('../src/services/subscriptionFlowService')
const { routeDetectedIntent } = require('../src/services/messageRouterService')
const { WELCOME_TEXT } = require('../src/utils/uxMessages')
const { parseMessage } = require('../src/services/parserCore')

subs = [{
  id: 'sub-1',
  serviceName: 'Netflix',
  amount: null,
  renewalDay: 27,
  renewalMonth: null,
  recurrence: 'monthly',
  active: true
}]

;(async () => {
  const show = detectIntent('Show subscriptions')
  const listed = await handleSubscriptionQueryIntent('919999999999', show)
  assert.equal(listed.subscriptions.length, 1)
  assert.equal(listed.subscriptions[0].serviceName, 'Netflix')
  assert.equal(listed.subscriptions[0].amount, null)

  created = 0
  const del = detectIntent('Delete all reminders')
  await routeDetectedIntent('919999999999', 'Delete all reminders', del)
  assert.equal(created, 0)
  assert.equal(parseMessage('Delete all reminders').draft?.serviceName, undefined)

  created = 0
  const showIntent = detectIntent('Show subscriptions')
  await routeDetectedIntent('919999999999', 'Show subscriptions', showIntent)
  assert.equal(created, 0)

  const blocked = await handleSubscriptionMessage('919999999999', 'Delete all reminders')
  assert.equal(blocked.blocked, true)
  assert.equal(created, 0)

  const hi = await handleHelpIntent('919999999999', { intent: INTENTS.HELP, rawText: 'hi' })
  assert.ok(hi.replySent)
  assert.match(WELCOME_TEXT, /bank statement/i)
  assert.match(WELCOME_TEXT, /Upload a bank statement/i)
  assert.doesNotMatch(WELCOME_TEXT, /Show subscriptions/)

  console.log('Production UX bug tests passed: 3')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
