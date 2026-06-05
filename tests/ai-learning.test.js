#!/usr/bin/env node
const assert = require('node:assert/strict')

const store = { ai_detection_logs: [] }
require.cache[require.resolve('../config/supabase')] = {
  exports: {
    from: (table) => ({
      insert: (row) => ({
        select: () => ({
          then: (resolve) => {
            store[table].push({ id: '1', ...row })
            return resolve({ data: [{ id: '1' }], error: null })
          }
        })
      }),
      select: () => ({
        eq: () => ({
          then: async (resolve) => resolve({ data: store.ai_detection_logs.filter((r) => r.used_ai && r.intent), error: null }),
          order: () => ({
            limit: (n) => ({
              then: async (resolve) =>
                resolve({ data: store.ai_detection_logs.filter((r) => r.used_ai).slice(0, n), error: null })
            })
          })
        }),
        order: () => ({
          limit: (n) => ({
            then: async (resolve) => resolve({ data: store.ai_detection_logs.slice(0, n), error: null })
          })
        })
      })
    })
  }
}

const aiLearning = require('../src/services/aiLearningService')

;(async () => {
  await aiLearning.recordAIFallback('mid-1', 'Wake me at 6 AM', {
    success: true,
    ai_intent: 'REMINDER_CREATE',
    entities: { actionText: 'wake up' },
    confidence: 0.91,
    model: 'gemini-2.5-flash',
    prompt_sent: 'p',
    ai_response: '{}'
  })
  assert.equal(store.ai_detection_logs.length, 1)
  const row = store.ai_detection_logs[0]
  assert.equal(row.message, 'Wake me at 6 AM')
  assert.equal(row.intent, 'REMINDER_CREATE')
  assert.equal(row.used_ai, true)

  store.ai_detection_logs.push({
    message: 'Netflix monthly',
    intent: 'SUBSCRIPTION_CREATE',
    entities: { serviceName: 'Netflix' },
    confidence: 0.88,
    used_ai: true
  })

  const counts = await aiLearning.getAIFallbackCountByIntent()
  assert.ok(counts.some((c) => c.intent === 'REMINDER_CREATE'))
  assert.ok((await aiLearning.getTopAIFallbackIntents(2)).length >= 1)
  assert.ok((await aiLearning.getRecentAIFallbackMessages(10)).length >= 1)
  console.log('AI learning tests passed: 5')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
