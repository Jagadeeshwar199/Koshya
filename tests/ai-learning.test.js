#!/usr/bin/env node
const assert = require('node:assert/strict')

const store = { ai_detection_logs: [] }
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
            store.ai_detection_logs.push({ id: '1', ...row })
            return resolve({ data: [{ id: '1' }], error: null })
          }
        })
      }),
      select: (cols, opts) => {
        if (opts?.count === 'exact') {
          return { eq: () => ({ then: async (r) => r({ count: store.ai_detection_logs.filter((x) => x.used_ai).length, error: null }) }) }
        }
        return {
          eq: () => ({
            then: async (r) => r({ data: store.ai_detection_logs.filter((x) => x.used_ai), error: null }),
            order: () => ({ limit: () => ({ then: async (r) => r({ data: store.ai_detection_logs, error: null }) }) })
          })
        }
      }
    })
  }
}

const ai = require('../src/services/aiLearningService')

;(async () => {
  await ai.recordDetectionLearning('m1', {
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
  const row = store.ai_detection_logs[0]
  assert.equal(row.ai_intent, 'UPDATE_REMINDER')
  assert.equal(row.prompt_sent.includes('last_entity_id: 123'), true)
  assert.equal(row.model, 'gemini-2.5-flash')
  assert.equal(row.gemini_response, row.response_sent)
  assert.equal(row.used_ai, true)

  errors.length = 0
  await ai.recordDetectionLearning('m-bad', {
    message: 'sorry 6 AM',
    used_ai: true,
    final_intent: 'REMINDER_RESCHEDULE'
  })
  assert.equal(errors.length, 1)
  assert.equal(errors[0].event, 'ai_learning.used_ai_missing_prompt')
  assert.equal(errors[0].message_id, 'm-bad')

  logger.error = origError
  await ai.recordDetectionLearning('m2', {
    message: 'show reminders',
    rule_intent: 'REMINDER_QUERY',
    rule_confidence: 88,
    final_intent: 'REMINDER_QUERY',
    entities: {},
    confidence: 88,
    used_ai: false,
    response_sent: 'Here are your reminders'
  })
  assert.equal(store.ai_detection_logs[2].used_ai, false)
  assert.equal(await ai.countAIUsage(), 2)
  console.log('AI learning mode tests passed: 7')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
