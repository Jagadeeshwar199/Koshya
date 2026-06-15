#!/usr/bin/env node
const assert = require('node:assert/strict')
const crypto = require('crypto')

const store = { execution_logs: [] }
const errors = []
const logger = require('../utils/logger')
const origError = logger.error
logger.error = (event, payload) => errors.push({ event, ...payload })
require.cache[require.resolve('../config/supabase')] = {
  exports: {
    from: () => ({
      insert: (row) => ({
        select: () => ({
          then: (resolve) => {
            store.execution_logs.push({ id: '1', ...row })
            return resolve({ data: [{ id: '1' }], error: null })
          }
        })
      }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              then: async (r) => r({ data: store.execution_logs, error: null })
            })
          }),
          then: async (r) => r({ data: store.execution_logs, error: null })
        })
      })
    })
  }
}

const ai = require('../src/services/aiLearningService')
const ctx = { requestId: crypto.randomUUID(), userId: '91' }

;(async () => {
  await ai.recordDetectionLearning(ctx, {
    message: 'sorry 6 AM',
    rule_intent: 'UNKNOWN',
    rule_confidence: 35,
    final_intent: 'REMINDER_RESCHEDULE',
    ai_intent: 'UPDATE_REMINDER',
    entities: { time: '06:00' },
    confidence: 95,
    used_ai: true,
    model: 'gemini-2.5-flash',
    prompt_sent: 'message: sorry 6 am\nlast_entity_id: 123',
    ai_response: '{"intent":"UPDATE_REMINDER"}',
    gemini_response: '✓ Updated',
    response_sent: '✓ Updated'
  })
  const row = store.execution_logs[0]
  assert.equal(row.stage, 'AI_CLASSIFICATION')
  assert.equal(row.output_data.ai_intent, 'UPDATE_REMINDER')
  assert.equal(row.output_data.used_ai, true)

  errors.length = 0
  await ai.recordDetectionLearning({ requestId: crypto.randomUUID() }, {
    message: 'sorry 6 AM',
    used_ai: true,
    final_intent: 'REMINDER_RESCHEDULE'
  })
  assert.equal(errors.length, 1)
  assert.equal(errors[0].event, 'ai_learning.used_ai_missing_prompt')

  logger.error = origError
  await ai.recordDetectionLearning({ requestId: crypto.randomUUID() }, {
    message: 'show reminders',
    rule_intent: 'REMINDER_QUERY',
    rule_confidence: 88,
    final_intent: 'REMINDER_QUERY',
    entities: {},
    confidence: 88,
    used_ai: false,
    response_sent: 'Here are your reminders'
  })
  assert.equal(store.execution_logs[2].output_data.used_ai, false)
  assert.equal(await ai.countAIUsage(), 2)
  console.log('AI learning mode tests passed: 7')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
