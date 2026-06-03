const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

const inserted = []
require.cache[require.resolve('../config/supabase')] = {
  exports: {
    from: () => ({
      insert: async (row) => {
        inserted.push(row)
        return { error: null }
      },
      select: () => ({
        eq: () => ({
          not: () => ({ limit: async () => ({ data: inserted.filter((r) => !r.success), error: null }) }),
          order: () => ({ limit: async () => ({ data: inserted.filter((r) => !r.success).slice(0, 50), error: null }) }),
          limit: async () => ({ data: inserted, error: null })
        }),
        in: () => ({ limit: async () => ({ data: [], error: null }) }),
        limit: async () => ({ data: inserted, error: null })
      })
    })
  }
}

async function run() {
  const {
    trackParserEvent,
    buildSnapshot,
    assessOutcome,
    routeName,
    parseAdminCommand,
    isAdminPhone
  } = require('../src/services/parserTelemetryService')
  const { INTENTS } = require('../src/services/intentService')

  assert.equal(parseAdminCommand('parser stats'), 'stats')
  assert.equal(parseAdminCommand('parser failures'), 'failures')
  assert.equal(parseAdminCommand('parser routes'), 'routes')
  assert.equal(parseAdminCommand('parser low-confidence'), 'low_confidence')

  process.env.ADMIN_PHONES = '91999'
  assert.equal(isAdminPhone('91999'), true)
  assert.equal(isAdminPhone('91888'), false)

  const snap = buildSnapshot('Netflix ends at 7 PM tomorrow', [
    require('../src/services/intentService').detectIntent('Netflix ends at 7 PM tomorrow')
  ])
  assert.ok(snap.detected_intents.includes('subscription_expiry'))
  assert.equal(snap.extracted_entities.service, 'Netflix')

  const bad = assessOutcome({
    clauses: snap.clauses,
    primaryIntent: INTENTS.SUBSCRIPTION_EXPIRY,
    selectedRoute: 'show_expiring_subscriptions',
    result: { ok: true, intent: INTENTS.SUBSCRIPTION_QUERY },
    responses: ['📅 Expiring soon\n\nNetflix']
  })
  assert.equal(bad.success, false)
  assert.match(bad.failure_reason, /wrong_route/)

  await trackParserEvent({
    user_id: '91',
    raw_message: 'Netflix ends at 7 PM tomorrow',
    normalized_message: snap.normalized_message,
    detected_intents: snap.detected_intents,
    confidence_scores: snap.confidence_scores,
    extracted_entities: snap.extracted_entities,
    selected_route: routeName(INTENTS.SUBSCRIPTION_EXPIRY),
    action_taken: 'create',
    success: bad.success,
    failure_reason: bad.failure_reason,
    response_sent: '📅 Expiry\n\nNetflix'
  })

  assert.equal(inserted.length, 1)
  assert.equal(inserted[0].extracted_entities.service, 'Netflix')
  assert.equal(inserted[0].success, false)

  console.log('Parser telemetry tests passed: 8')
}

run()
