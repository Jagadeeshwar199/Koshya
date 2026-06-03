#!/usr/bin/env node
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const sent = []
const db = { reminders: [{ id: 'r1', message: 'go to the toilet', triggerAt: new Date().toISOString(), status: 'pending' }], archived: [] }
require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async (_s, body) => { sent.push(body); return { success: true } },
    setOutboundCapture: () => {},
    clearOutboundCapture: () => {}
  }
}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: { getState: async () => null, setState: async () => {}, clearState: async () => {} }
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
        id: `r${db.reminders.length + 1}`,
        message: realReminder.packReminderMessage(
          realReminder.extractReminderTitle(message, entities.serviceName),
          { daily: /\b(?:daily|every\s+day)\b/i.test(message) }
        ),
        triggerAt: realReminder.resolveTriggerAt(entities.date).toISOString(),
        status: 'pending'
      }
      db.reminders.push(row)
      return row
    },
    getLatestActiveReminder: async () => db.reminders.filter((r) => r.status === 'pending').slice(-1)[0] || null,
    getActiveReminders: async () => db.reminders.filter((r) => r.status === 'pending'),
    getUserReminders: async () => db.reminders.filter((r) => r.status === 'pending'),
    getPendingReminders: async () => db.reminders.filter((r) => r.status === 'pending'),
    updateLatestReminderFromIntent: async ({ entities }) => {
      const r = db.reminders.filter((x) => x.status === 'pending').slice(-1)[0]
      if (!r || !entities.date) return null
      r.triggerAt = realReminder.resolveTriggerAt(entities.date, new Date(r.triggerAt)).toISOString()
      return r
    },
    cancelReminderFromIntent: async ({ entities }) => {
      const subj = String(entities.serviceName || '').toLowerCase()
      const matches = db.reminders.filter((r) => {
        const t = realReminder.unpackReminderMessage(r.message).title.toLowerCase()
        return r.status === 'pending' && (!subj || t.includes(subj) || subj.includes(t))
      })
      if (!matches.length) return { status: 'not_found', reminders: [] }
      if (matches.length > 1) return { status: 'multiple', reminders: matches }
      matches[0].status = 'cancelled'
      return { status: 'cancelled', reminder: matches[0] }
    },
    needsExplicitTimePrompt: require('../src/services/intentService').needsExplicitTimePrompt,
    computeNextRenewalDate: realReminder.computeNextRenewalDate
  }
}
require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => [
      { id: '1', serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }
    ],
    updateSubscription: async () => ({}),
    createSubscriptionRecord: async (d) => ({ id: '2', ...d }),
    archiveSubscription: async (_p, id) => { db.archived.push(id); return {} },
    resolveSubscriptionDelete: async () => ({ status: 'confirm', subscription: { serviceName: 'Netflix' } })
  }
}
require.cache[require.resolve('../src/utils/serviceMatcher')] = {
  exports: {
    matchSubscriptionsByService: (subs, name) =>
      subs.filter((s) => s.serviceName.toLowerCase().includes(String(name).toLowerCase()))
  }
}

const { routeWhatsAppMessage } = require('../src/services/messageRouterService')
const { detectIntent, detectClauseIntents } = require('../src/services/intentService')
const { extractReminderTitle } = require('../src/services/reminderService')

const cases = [
  { id: 1, msg: 'Remaind me to go to the toilet at 1 AM', intent: 'REMINDER_CREATE', route: /Reminder set/i, noRoute: /Show reminders/i, title: 'go to the toilet', entity: (e) => e.date?.time?.hour === 1 },
  { id: 2, msg: 'change my toilet reminder to 2 AM', intent: 'REMINDER_RESCHEDULE', route: /updated|2 AM|toilet/i, entity: (e) => e.date?.time?.hour === 2, setup: () => {} },
  { id: 3, msg: 'delete my toilet reminder', intent: 'REMINDER_CANCEL', route: /deleted|cancelled|toilet/i, entity: (e) => /toilet/i.test(e.serviceName || '') },
  { id: 4, msg: 'show my reminders', intent: 'REMINDER_QUERY', route: /reminder/i, noRoute: /Reminder set|When should I/ },
  { id: 5, msg: 'remind me in 5 mins', intent: 'REMINDER_CREATE', route: /Reminder set/i, title: 'Reminder', entity: (e) => e.date?.kind === 'offset' },
  { id: 6, msg: 'Netflix ends at 7 PM tomorrow', intent: 'SUBSCRIPTION_EXPIRY', route: /Expiry|isn't tracked/i, noRoute: /Expiring soon/i, entity: (e) => e.serviceName === 'Netflix' },
  { id: 7, msg: 'Netflix every month on 27th', intent: 'SUBSCRIPTION_CREATE', route: /Netflix|amount|month|27|Got Netflix|need/i, entity: (e) => /^Netflix$/i.test(e.serviceName || '') && e.recurrence === 'monthly' },
  { id: 8, msg: 'change Netflix expiry to tomorrow 9 PM', intent: 'SUBSCRIPTION_UPDATE', route: /Updated Netflix expiry|Netflix/i, noRoute: /Expiring soon/i },
  { id: 9, msg: 'delete Netflix subscription', intent: 'SUBSCRIPTION_DELETE', route: /delete|confirm|Netflix/i, noRoute: /Expiring soon/i },
  { id: 10, msg: 'show my subscriptions', intent: 'SUBSCRIPTION_QUERY', route: /Subscriptions/i, noRoute: /isn't tracked yet/i },
  { id: 11, msg: 'SuperStream expires tomorrow', intent: 'SUBSCRIPTION_EXPIRY', route: /isn't tracked yet/i, noRoute: /No matching/i },
  { id: 12, msg: 'Netflix expires tomorrow and remind me today at 8 PM', intents: ['SUBSCRIPTION_EXPIRY', 'REMINDER_CREATE'], route: /Expiry|Reminder set|isn't tracked/i },
  { id: 13, msg: 'netflix tmrw', intent: 'UNKNOWN', route: /What should I do with/i, noRoute: /Expiring soon|Subscriptions\n\nNetflix/i },
  { id: 14, msg: 'what is expiring soon', intent: 'SUBSCRIPTION_QUERY', route: /Expiring soon/i, noRoute: /Reminder set/i, entity: (e) => e.queryType === 'expiry' }
]

async function runCase(c) {
  if (c.setup) c.setup()
  sent.length = 0
  const intents = c.intents || [c.intent]
  const detected = c.intents ? detectClauseIntents(c.msg).map((x) => x.intent) : [detectIntent(c.msg).intent]
  let ok = intents.every((i) => detected.includes(i))
  let reason = ok ? '' : `intent ${detected.join('+')} != ${intents.join('+')}`

  const primary = c.intents ? detectClauseIntents(c.msg).find((x) => x.intent === c.intent) || detectClauseIntents(c.msg)[0] : detectIntent(c.msg)
  if (ok && c.entity && !c.entity(primary.entities)) { ok = false; reason = 'entities' }
  if (ok && c.title) {
    const t = extractReminderTitle(primary.rawText || c.msg, primary.entities.serviceName)
    if (!String(t).toLowerCase().includes(c.title.toLowerCase())) { ok = false; reason = `title=${t}` }
  }

  await routeWhatsAppMessage('919999999999', c.msg)
  const body = sent.join('\n')
  if (ok && !c.route.test(body)) { ok = false; reason = `route: ${body.slice(0, 120)}` }
  if (ok && c.noRoute && c.noRoute.test(body)) { ok = false; reason = 'noRoute' }
  return { ok, reason }
}

async function run() {
  let pass = 0
  let fail = 0
  for (const c of cases) {
    const { ok, reason } = await runCase(c)
    console.log(`${ok ? 'PASS' : 'FAIL'} | #${c.id} ${c.intent || c.intents?.join('+')} | "${c.msg}"`)
    if (!ok) console.log(`  ${reason}`)
    ok ? pass++ : fail++
  }
  console.log(`\nTotal: ${pass + fail}\nPassed: ${pass}\nFailed: ${fail}`)
  process.exit(fail ? 1 : 0)
}

run()
