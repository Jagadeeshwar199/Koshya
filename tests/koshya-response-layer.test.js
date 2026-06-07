#!/usr/bin/env node
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
const assert = require('node:assert/strict')
const { buildKoshyaResponse } = require('../src/services/koshyaResponseLayer')
const { INTENTS } = require('../src/services/intentService')

const raw = `{"intent":"REMINDER_CREATE","confidence":95,"reasoning":"user wants daily alarm"}
✓ Reminder set

Take tablets
Every day · 9:00 PM`

const { text, geminiStored } = buildKoshyaResponse({
  intent: INTENTS.REMINDER_CREATE,
  entities: { actionText: 'take tablets' },
  geminiRaw: raw,
  execResult: null,
  validationOk: true
})
assert.ok(!text.includes('confidence'))
assert.ok(!text.includes('reasoning'))
assert.ok(!text.includes('{'))
assert.ok(text.split('\n').length <= 4)
assert.equal(geminiStored, raw)

const exec = buildKoshyaResponse({
  intent: INTENTS.REMINDER_CREATE,
  entities: {},
  geminiRaw: 'ignore me',
  execResult: {
    ok: true,
    reminder: { message: 'wake up', triggerAt: new Date('2026-06-06T06:00:00Z').toISOString() }
  },
  validationOk: true
})
assert.ok(exec.text.startsWith('✅'))
assert.ok(!exec.text.includes('ignore me'))

const createViaExec = buildKoshyaResponse({
  intent: INTENTS.REMINDER_RESCHEDULE,
  entities: {},
  geminiRaw: null,
  execResult: {
    ok: true,
    intent: INTENTS.REMINDER_CREATE,
    reminder: { message: 'wake up', triggerAt: new Date('2026-06-06T06:00:00Z').toISOString() }
  },
  validationOk: true
})
assert.match(createViaExec.text, /Got it/)

const updateViaExec = buildKoshyaResponse({
  intent: INTENTS.REMINDER_CREATE,
  entities: {},
  geminiRaw: null,
  execResult: {
    ok: true,
    intent: INTENTS.REMINDER_RESCHEDULE,
    reminder: { message: 'wake up', triggerAt: new Date('2026-06-06T06:00:00Z').toISOString() }
  },
  validationOk: true
})
assert.match(updateViaExec.text, /Got it/)

console.log('Koshya response layer tests passed: 6')
