#!/usr/bin/env node
const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const { parseMessage } = require('../src/core/parser')
const { normalizeEvent } = require('../src/core/normalizer')
const { selectFlowName } = require('../src/flows')
const { INTENTS } = require('../src/services/intentService')

;(async () => {
  const parsed = await parseMessage('remind me tomorrow at 8pm to check fw channel', { skipAi: true })
  assert.ok(parsed.event_name)
  assert.ok(parsed.normalized)
  assert.equal(parsed.parser_used, true)
  assert.equal(parsed.ai_used, false)

  const event = normalizeEvent(parsed)
  assert.equal(event.message, parsed.normalized)
  assert.equal(event.event_name, parsed.event_name)
  assert.ok('trigger_time' in event)
  assert.ok('recurrence' in event)
  assert.ok(typeof event.confidence === 'number')

  assert.equal(selectFlowName(INTENTS.REMINDER_CREATE), 'create')
  assert.equal(selectFlowName(INTENTS.REMINDER_QUERY), 'list')
  assert.equal(selectFlowName(INTENTS.REMINDER_CANCEL), 'delete')
  assert.equal(selectFlowName(INTENTS.SUBSCRIPTION_CREATE), 'subscription')

  const core = require('../src/core')
  assert.equal(typeof core.processMessage, 'function')
  assert.equal(typeof core.normalizeEvent, 'function')
  assert.equal(typeof core.logExecution, 'function')

  console.log('Core architecture tests passed: 6')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
