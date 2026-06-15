#!/usr/bin/env node
const assert = require('node:assert/strict')
const crypto = require('crypto')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const store = { execution_logs: [], system_errors: [] }
require.cache[require.resolve('../config/supabase')] = {
  exports: {
    from: (table) => ({
      insert: (row) => ({
        select: () => ({
          then: (resolve) => {
            const id = `${table}-${store[table].length + 1}`
            store[table].push({ id, ...row })
            return resolve({ data: [{ id }], error: null })
          }
        })
      }),
      select: () => ({ eq: () => ({ limit: async () => ({ data: store[table], error: null }) }) })
    })
  }
}

require.cache[require.resolve('../src/services/whatsappService')] = {
  exports: {
    sendWhatsAppMessage: async () => ({ success: true }),
    setOutboundCapture: () => {},
    clearOutboundCapture: () => {},
    setActiveReplyMessageId: () => {},
    clearActiveReplyMessageId: () => {}
  }
}

async function run() {
  const { validateIntent } = require('../src/services/intentValidationService')
  const pipeline = require('../src/services/intentPipelineService')
  const { INTENTS } = require('../src/services/intentService')

  assert.equal(validateIntent({ intent: INTENTS.UNKNOWN, entities: {} }, 'foo').passed, false)

  const ctx = pipeline.createContext('91', 'Netflix ends at 7 PM tomorrow', { requestId: crypto.randomUUID() })
  await pipeline.stageNormalize(ctx)
  assert.equal(store.execution_logs.filter((r) => r.stage === 'NORMALIZATION').length, 1)

  const intent = await pipeline.stageDetect(ctx, 'Netflix ends at 7 PM tomorrow')
  assert.equal(store.execution_logs.filter((r) => r.stage === 'INTENT_DETECTION').length, 1)
  assert.ok(intent.confidence > 0)

  const ai = await pipeline.stageAI(ctx, { ...intent, confidence: 0.1 }, 'test')
  assert.ok(ai)

  const v = await pipeline.stageValidate(ctx, intent, 'Netflix ends at 7 PM tomorrow')
  assert.equal(store.execution_logs.filter((r) => r.stage === 'VALIDATION').length, 1)
  assert.equal(v.passed, true)

  await pipeline.stageExecute(ctx, 'SUBSCRIPTION_EXPIRY', async () => ({ ok: true }))
  assert.ok(store.execution_logs.some((r) => r.stage === 'ACTION_SELECTION' || r.stage === 'SUBSCRIPTION_UPDATED'))

  console.log('Intent pipeline tests passed:', 6)
}

run()
