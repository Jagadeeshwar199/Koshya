const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const {
  matchSubscriptionsByService
} = require('../src/controllers/reminderController')

const subscriptions = [
  {
    serviceName: 'Netflix Spotify',
    amount: 119,
    renewalDay: 15,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-31T18:35:40.621Z'
  },
  {
    serviceName: 'Netflix Prime',
    amount: 1499,
    renewalDay: 20,
    renewalMonth: 'Jan',
    recurrence: 'yearly',
    createdAt: '2026-05-31T18:35:26.322Z'
  },
  {
    serviceName: 'Netflix Netflix',
    amount: 149,
    renewalDay: 27,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-31T18:35:15.195Z'
  },
  {
    serviceName: 'Netflix',
    amount: 1299,
    renewalDay: 13,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-31T17:17:24.974Z'
  },
  {
    serviceName: 'Netflix',
    amount: 149,
    renewalDay: 27,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-31T16:29:15.116Z'
  },
  {
    serviceName: 'Netflix',
    amount: 149,
    renewalDay: 27,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-29T19:28:02.408Z'
  },
  {
    serviceName: 'Spotify',
    amount: 119,
    renewalDay: 15,
    renewalMonth: null,
    recurrence: 'monthly',
    createdAt: '2026-05-31T16:28:23.446Z'
  },
  {
    serviceName: 'Prime',
    amount: 1499,
    renewalDay: 20,
    renewalMonth: 'Jan',
    recurrence: 'yearly',
    createdAt: '2026-05-31T16:29:37.049Z'
  }
]

const netflix = matchSubscriptionsByService(subscriptions, 'Netflix')
assert.equal(netflix[0].serviceName, 'Netflix')
assert.equal(netflix[0].amount, 149)
assert.equal(netflix[0].renewalDay, 27)
assert.notEqual(netflix[0].serviceName, 'Netflix Spotify')
assert.notEqual(netflix[0].serviceName, 'Netflix Prime')
assert.notEqual(netflix[0].serviceName, 'Netflix Netflix')

const spotify = matchSubscriptionsByService(subscriptions, 'Spotify')
assert.equal(spotify[0].serviceName, 'Spotify')
assert.equal(spotify[0].amount, 119)
assert.equal(spotify[0].renewalDay, 15)

const prime = matchSubscriptionsByService(subscriptions, 'Prime')
assert.equal(prime[0].serviceName, 'Prime')
assert.equal(prime[0].amount, 1499)
assert.equal(prime[0].renewalDay, 20)

const normalized = matchSubscriptionsByService(
  [{ serviceName: 'Jio-Hotstar', amount: 599, renewalDay: 12 }],
  'Jio Hotstar'
)
assert.equal(normalized[0].serviceName, 'Jio-Hotstar')

console.log('Reminder query matching tests passed: 4')
