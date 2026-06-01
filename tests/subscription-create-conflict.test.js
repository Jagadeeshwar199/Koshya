const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

const existingRow = {
  id: 'existing-subscription',
  user_phone: '919999999999',
  service_name: 'Netflix',
  amount: 149,
  renewal_day: 27,
  renewal_month: null,
  recurrence: 'monthly',
  active: true,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: null
}
let updateCall = null

function createBuilder() {
  const state = {
    action: 'select',
    filters: []
  }

  const builder = {
    insert(row) {
      state.action = 'insert'
      state.row = row
      return builder
    },
    update(payload) {
      state.action = 'update'
      state.payload = payload
      return builder
    },
    select() {
      return builder
    },
    eq(column, value) {
      state.filters.push({ column, value })
      return builder
    },
    order() {
      return builder
    },
    maybeSingle: async () => execute(state),
    then: (resolve, reject) => Promise.resolve(execute(state)).then(resolve, reject)
  }

  return builder
}

function execute(state) {
  if (state.action === 'insert') {
    return {
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_subscriptions_active_unique"'
      }
    }
  }

  if (state.action === 'update') {
    updateCall = {
      id: state.filters.find((filter) => filter.column === 'id')?.value,
      payload: state.payload
    }

    return {
      data: {
        ...existingRow,
        ...state.payload
      },
      error: null
    }
  }

  return {
    data: [existingRow],
    error: null
  }
}

require.cache[require.resolve('../config/supabase')] = {
  exports: {
    from: (table) => {
      assert.equal(table, 'subscriptions')
      return createBuilder()
    }
  }
}

const { createSubscriptionRecord } = require('../src/services/subscriptionService')

async function run() {
  const subscription = await createSubscriptionRecord({
    userPhone: '919999999999',
    serviceName: 'Netflix',
    amount: 199,
    renewalDay: 28,
    renewalMonth: null,
    recurrence: 'monthly'
  })

  assert.equal(subscription.id, 'existing-subscription')
  assert.equal(subscription.amount, 199)
  assert.equal(subscription.renewalDay, 28)
  assert.equal(updateCall.id, 'existing-subscription')
  assert.equal(updateCall.payload.service_name, 'Netflix')
  assert.equal(updateCall.payload.amount, 199)
  assert.equal(updateCall.payload.renewal_day, 28)
  assert.ok(updateCall.payload.updated_at)

  console.log('Subscription create conflict tests passed: 8')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
