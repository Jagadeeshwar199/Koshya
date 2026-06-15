#!/usr/bin/env node
/**
 * Koshya regression suite — intent detection + production routing path.
 * No RLS/auth/production DB touched; all services mocked in-process.
 */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
process.env.ENABLE_LEGACY_INTENT_ENGINE = process.env.ENABLE_LEGACY_INTENT_ENGINE || 'true'

const sent = []
const db = { reminders: [], subscriptions: [], messages: [] }
const stateByPhone = {}

require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async (_s, body) => {
      sent.push(body)
      return { success: true }
    },
    setOutboundCapture: (fn) => { sent._cap = fn },
    clearOutboundCapture: () => { sent._cap = null },
    setActiveReplyMessageId: () => {},
    clearActiveReplyMessageId: () => {}
  }
}
require.cache[require.resolve('../src/services/conversationStateService')] = {
  exports: {
    getState: async (p) => stateByPhone[p] || null,
    setState: async (p, patch) => {
      stateByPhone[p] = { ...(stateByPhone[p] || {}), ...patch }
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined) delete stateByPhone[p][k]
      }
    },
    clearState: async (p) => { delete stateByPhone[p] }
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
    createReminderFromIntent: async ({ message, entities, parseMeta }) => {
      const row = {
        id: `r${db.reminders.length + 1}`,
        message: realReminder.packReminderMessage(
          parseMeta?.taskText || realReminder.extractReminderTitle(message, entities?.serviceName)
        ),
        triggerAt: realReminder.resolveTriggerAt(entities?.date || { kind: 'relative', value: 'tomorrow' }).toISOString(),
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
      if (!r || !entities?.date) return null
      r.triggerAt = realReminder.resolveTriggerAt(entities.date, new Date(r.triggerAt)).toISOString()
      return r
    },
    resolveTriggerAt: realReminder.resolveTriggerAt,
    normalizeReminderMessage: realReminder.normalizeReminderMessage,
    cancelReminder: async (id) => {
      const r = db.reminders.find((x) => x.id === id)
      if (r) r.status = 'cancelled'
      return r
    },
    cancelReminderFromIntent: async ({ entities }) => {
      const subj = String(entities?.serviceName || '').toLowerCase()
      const matches = db.reminders.filter((r) => {
        const t = realReminder.unpackReminderMessage(r.message).title.toLowerCase()
        return r.status === 'pending' && (!subj || t.includes(subj) || subj.includes(t))
      })
      if (!matches.length) return { status: 'not_found', reminders: [] }
      if (matches.length > 1) return { status: 'multiple', reminders: matches }
      matches[0].status = 'cancelled'
      return { status: 'cancelled', reminder: matches[0] }
    }
  }
}
require.cache[require.resolve('../src/services/subscriptionService')] = {
  exports: {
    getUserSubscriptions: async () => db.subscriptions.length
      ? db.subscriptions
      : [{ id: 's1', serviceName: 'Netflix', amount: 149, recurrence: 'monthly', renewalDay: 27 }],
    createSubscriptionRecord: async (d) => {
      const row = { id: `s${db.subscriptions.length + 1}`, ...d }
      db.subscriptions.push(row)
      return row
    },
    updateSubscription: async () => ({}),
    archiveSubscription: async () => ({}),
    resolveSubscriptionDelete: async () => ({ status: 'confirm', subscription: { serviceName: 'Netflix' } })
  }
}
const realMatcher = require('../src/utils/serviceMatcher')
require.cache[require.resolve('../src/utils/serviceMatcher')] = {
  exports: {
    ...realMatcher,
    matchSubscriptionsByService: (subs, name) =>
      subs.filter((s) => s.serviceName.toLowerCase().includes(String(name).toLowerCase()))
  }
}

const { detectIntent, INTENTS } = require('../src/services/intentService')
const { routeWhatsAppMessage } = require('../src/services/messageRouterService')
const cases = require('./fixtures/regression-messages')

const PHONE = '919999999999'
const ROUTE_SKIP = new Set([
  INTENTS.CONFIRM,
  INTENTS.CANCEL,
  INTENTS.LIST_MORE,
  INTENTS.UNKNOWN
])

function resetDb() {
  db.reminders.length = 0
  db.subscriptions.length = 0
  db.messages.length = 0
  delete stateByPhone[PHONE]
  sent.length = 0
}

function rootCause(err) {
  if (!err) return null
  const stack = String(err.stack || err).split('\n')
  const frame = stack.find((l) => l.includes('/src/') && !l.includes('regression-suite'))
  if (!frame) return { file: 'unknown', function: 'unknown', line: 0, message: err.message }
  const m = frame.trim().match(/at\s+(?:(\S+)\s+)?\(?(.+):(\d+):(\d+)\)?/)
  return {
    file: m ? path.basename(m[2]) : 'unknown',
    function: m?.[1] || 'unknown',
    line: m ? Number(m[3]) : 0,
    message: err.message
  }
}

async function runRoutingCase(message) {
  resetDb()
  db.reminders.push({
    id: 'r1',
    message: realReminder.packReminderMessage('gym'),
    triggerAt: new Date().toISOString(),
    status: 'pending'
  })
  let execResult = null
  let thrown = null
  try {
    execResult = await routeWhatsAppMessage(PHONE, message)
  } catch (e) {
    thrown = e
  }
  const replies = [...sent]
  const duplicateReply = replies.length > 1 && new Set(replies).size < replies.length
  return {
    execResult,
    thrown,
    replies,
    duplicateReply,
    dbWrites: { reminders: db.reminders.length, subscriptions: db.subscriptions.length },
    nullReply: replies.some((r) => r == null),
    emptyReply: replies.length === 0
  }
}

async function main() {
  const results = []
  const passes = []
  const fails = []

  for (const c of cases.all()) {
    const record = {
      message: c.message,
      expected: c.category,
      accept: c.accept || [c.intent],
      detected: null,
      confidence: null,
      entities: null,
      routing: null,
      replies: [],
      dbWrites: null,
      exception: null,
      issues: [],
      pass: false
    }

    try {
      const det = detectIntent(c.message)
      record.detected = det.intent
      record.confidence = det.confidence
      record.entities = det.entities

      const intentOk = record.accept.includes(det.intent)
      if (!intentOk) {
        record.issues.push(`intent: got ${det.intent}, expected one of ${record.accept.join('|')}`)
      }

      if (!ROUTE_SKIP.has(c.category)) {
        const route = await runRoutingCase(c.message)
        record.routing = route.execResult?.intent || route.execResult?.ok
        record.replies = route.replies
        record.dbWrites = route.dbWrites
        if (route.thrown) {
          record.exception = rootCause(route.thrown)
          record.issues.push(`crash: ${route.thrown.message}`)
        }
        if (route.nullReply) record.issues.push('null AI/reply')
        if (route.duplicateReply) record.issues.push('duplicate responses')
        const needsReply = !ROUTE_SKIP.has(det.intent) && det.intent !== INTENTS.REMINDER_RESCHEDULE
        if (route.emptyReply && needsReply) {
          record.issues.push('missing reply')
        }
        if (route.execResult?.ok === false) {
          record.issues.push('execution failed')
        }
      }

      record.pass = record.issues.length === 0
    } catch (e) {
      record.exception = rootCause(e)
      record.issues.push(`crash: ${e.message}`)
      record.pass = false
    }

    results.push(record)
    if (record.pass) passes.push(`${c.category}: "${c.message}"`)
    else {
      fails.push({
        scenario: `${c.category}: "${c.message}"`,
        detected: record.detected,
        issues: record.issues,
        rootCause: record.exception
      })
    }
  }

  const total = results.length
  const passRate = Math.round((passes.length / total) * 10000) / 100
  const report = {
    generatedAt: new Date().toISOString(),
    total,
    passed: passes.length,
    failed: fails.length,
    passRate,
    passes,
    fails,
    results
  }

  const outPath = path.join(__dirname, 'regression-report.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log('\n=== KOSHya REGRESSION REPORT ===')
  console.log(`Total: ${total} | Pass: ${passes.length} | Fail: ${fails.length} | Rate: ${passRate}%`)
  if (fails.length) {
    console.log('\nFAILURES:')
    for (const f of fails.slice(0, 30)) {
      console.log(`  - ${f.scenario}`)
      console.log(`    detected=${f.detected} issues=${f.issues.join('; ')}`)
      if (f.rootCause) console.log(`    root: ${f.rootCause.file}:${f.rootCause.line} ${f.rootCause.function}`)
    }
    if (fails.length > 30) console.log(`  ... +${fails.length - 30} more (see regression-report.json)`)
  }
  console.log(`\nReport: ${outPath}`)

  assert.ok(passRate >= 98, `Regression pass rate ${passRate}% below 98% threshold (${fails.length} failures)`)
  console.log(`Regression suite passed: ${passes.length}/${total}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
