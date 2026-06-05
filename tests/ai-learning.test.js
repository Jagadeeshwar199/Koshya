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
          return {
            eq: () => ({
              then: async (resolve) =>
                resolve({ count: store.ai_detection_logs.filter((r) => r.used_ai).length, error: null })
            })
          }
        }
        return {
          eq: () => ({
            then: async (resolve) =>
              resolve({
                data: store.ai_detection_logs.filter((r) => r.used_ai && (r.final_intent || r.intent)),
                error: null
              }),
            order: () => ({
              limit: (n) => ({
                then: async (resolve) =>
                  resolve({ data: store.ai_detection_logs.filter((r) => r.used_ai).slice(0, n), error: null })
              })
            })
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
    used_ai: true
  })
  const row = store.ai_detection_logs[0]
  assert.equal(row.rule_intent, 'UNKNOWN')
  assert.equal(row.rule_confidence, 35)
  assert.equal(row.final_intent, 'REMINDER_CREATE')
  assert.equal(row.used_ai, true)

  await ai.recordDetectionLearning('m2', {
    message: 'show reminders',
    rule_intent: 'REMINDER_QUERY',
    rule_confidence: 88,
    final_intent: 'REMINDER_QUERY',
    entities: {},
    confidence: 88,
    used_ai: false
  })
  assert.equal(store.ai_detection_logs[1].used_ai, false)
  assert.equal(await ai.countAIUsage(), 1)
  assert.ok((await ai.getTopAIFallbackIntents(5)).some((x) => x.intent === 'REMINDER_CREATE'))
  console.log('AI threshold learning tests passed: 6')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
