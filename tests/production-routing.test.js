#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const sent = []
require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: { sendWhatsAppMessage: async (_s, body) => { sent.push(body); return { success: true } } }
}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: { getState: async () => null, setState: async () => {}, clearState: async () => {} }
}
require.cache[require.resolve('../src/services/pendingSubscriptionService')] = {
  exports: { getPending: async () => null }
}
require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => [{ serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }],
    updateSubscription: async () => ({}),
    archiveSubscription: async () => ({})
  }
}
require.cache[require.resolve('../src/utils/serviceMatcher')] = {
  exports: {
    matchSubscriptionsByService: (subs, name) =>
      subs.filter((s) => s.serviceName.toLowerCase().includes(String(name).toLowerCase()))
  }
}
require.cache[require.resolve('../src/services/reminderService')] = {
  exports: {
    ...require('../src/services/reminderService'),
    createReminderFromIntent: async ({ message, entities }) => ({
      message: require('../src/services/reminderService').extractReminderTitle(message, entities.serviceName),
      triggerAt: new Date().toISOString()
    }),
    needsExplicitTimePrompt: require('../src/services/intentService').needsExplicitTimePrompt
  }
}

const { routeWhatsAppMessage } = require('../src/services/messageRouterService')
const { detectIntent, detectClauseIntents } = require('../src/services/intentService')
const { extractReminderTitle } = require('../src/services/reminderService')

const cases = [
  { msg: 'Remaind me to go to the toilet at 1 AM', intent: 'REMINDER_CREATE', route: (b) => !/Show today|Show reminders/i.test(b), title: 'go to the toilet' },
  { msg: 'Netflix ends at 7 PM tomorrow', intent: 'SUBSCRIPTION_EXPIRY', route: (b) => /Expiry|isn't tracked/i.test(b) && !/Expiring soon/i.test(b) },
  { msg: 'Prime expires at midnight', intent: 'SUBSCRIPTION_EXPIRY', route: (b) => !/Expiring soon/i.test(b) },
  { msg: 'SuperStream expires tomorrow', intent: 'SUBSCRIPTION_EXPIRY', route: (b) => /isn't tracked yet/i.test(b) },
  { msg: 'netflix tmrw', intent: 'UNKNOWN', route: (b) => /What should I do with/i.test(b) },
  { msg: 'rmndr mom tmrw', intent: 'REMINDER_CREATE', route: (b) => /When should I remind you/i.test(b), title: 'mom' }
]

async function run() {
  let pass = 0
  let fail = 0
  for (const c of cases) {
    sent.length = 0
    const intent = detectIntent(c.msg)
    let ok = intent.intent === c.intent
    let reason = ok ? '' : `intent ${intent.intent} != ${c.intent}`
    if (ok && c.title) {
      const t = extractReminderTitle(intent.rawText || c.msg, intent.entities.serviceName)
      if (!String(t).toLowerCase().includes(c.title)) { ok = false; reason = `title ${t}` }
    }
    await routeWhatsAppMessage('919999999999', c.msg)
    if (ok && c.route && !c.route(sent.join('\n'))) { ok = false; reason = `route: ${sent.join(' ').slice(0, 80)}` }
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.intent} | "${c.msg}"`)
    if (!ok) console.log(`Reason: ${reason}`)
    ok ? pass++ : fail++
  }
  const multi = detectClauseIntents('Netflix expires tomorrow and remind me today at 8 PM').map((c) => c.intent)
  const multiOk = multi.includes('SUBSCRIPTION_EXPIRY') && multi.includes('REMINDER_CREATE')
  sent.length = 0
  await routeWhatsAppMessage('919999999999', 'Netflix expires tomorrow and remind me today at 8 PM')
  const routeMulti = sent.some((b) => /Expiry|Reminder set/i.test(b))
  console.log(`${multiOk && routeMulti ? 'PASS' : 'FAIL'} | MULTI | Netflix expires... and remind...`)
  multiOk && routeMulti ? pass++ : (fail++, console.log(`Reason: intents=${multi.join(',')} replies=${sent.length}`))
  console.log(`\nTotal: ${pass + fail}\nPassed: ${pass}\nFailed: ${fail}`)
  process.exit(fail ? 1 : 0)
}

run()
