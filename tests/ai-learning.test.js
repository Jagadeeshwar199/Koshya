#!/usr/bin/env node
const assert = require('node:assert/strict')

const store = { ai_detection_logs: [] }
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
    message: 'Wake me up every day at 6 AM',
    rule_intent: 'UNKNOWN',
    rule_confidence: 35,
    final_intent: 'REMINDER_CREATE',
    entities: { task: 'wake up', time: '06:00', recurrence: 'DAILY' },
    confidence: 95,
    used_ai: true,
    gemini_response: '✓ Reminder set\n\nWake up\nEvery day · 6:00 AM',
    response_sent: '✓ Reminder set\n\nWake up\nEvery day · 6:00 AM'
  })
  const row = store.ai_detection_logs[0]
  assert.equal(row.gemini_response, row.response_sent)
  assert.equal(row.used_ai, true)
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
  assert.equal(store.ai_detection_logs[1].used_ai, false)
  assert.equal(await ai.countAIUsage(), 1)
  console.log('AI learning mode tests passed: 5')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
