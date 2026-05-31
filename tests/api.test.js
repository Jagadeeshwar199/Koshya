const assert = require('node:assert/strict')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-key'

const app = require('../server')

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  return {
    status: response.status,
    body
  }
}

async function run() {
  const server = await listen(app)
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const parsed = await request(baseUrl, '/api/parse', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Netflix renews on 27th every month - 149'
      })
    })

    assert.equal(parsed.status, 200)
    assert.equal(parsed.body.type, 'subscription')
    assert.equal(parsed.body.success, true)
    assert.equal(parsed.body.serviceName, 'Netflix')
    assert.equal(parsed.body.amount, 149)

    const invalidParse = await request(baseUrl, '/api/parse', {
      method: 'POST',
      body: JSON.stringify({
        message: ''
      })
    })

    assert.equal(invalidParse.status, 400)
    assert.equal(invalidParse.body.success, false)

    const invalidPhone = await request(baseUrl, '/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        userPhone: '123',
        message: 'Netflix renews on 27th every month - 149'
      })
    })

    assert.equal(invalidPhone.status, 400)
    assert.equal(invalidPhone.body.error, 'userPhone must contain 8 to 15 digits')

    const incompleteSubscription = await request(baseUrl, '/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        userPhone: '919999999999',
        message: 'Netflix'
      })
    })

    assert.equal(incompleteSubscription.status, 422)
    assert.equal(incompleteSubscription.body.error, 'message does not contain a complete subscription')

    const emptyUpdate = await request(baseUrl, '/api/subscriptions/test-id', {
      method: 'PUT',
      body: JSON.stringify({})
    })

    assert.equal(emptyUpdate.status, 400)
    assert.match(emptyUpdate.body.error, /At least one update field is required/)

    const invalidReminderWindow = await request(baseUrl, '/api/reminders/generate', {
      method: 'POST',
      body: JSON.stringify({
        daysAhead: 31
      })
    })

    assert.equal(invalidReminderWindow.status, 400)
    assert.equal(invalidReminderWindow.body.error, 'daysAhead must be an integer between 0 and 30')

    const notFound = await request(baseUrl, '/api/does-not-exist')

    assert.equal(notFound.status, 404)
    assert.equal(notFound.body.error, 'Route not found')

    console.log('API route tests passed: 7')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
