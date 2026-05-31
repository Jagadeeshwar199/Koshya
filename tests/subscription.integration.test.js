const assert =
  require('node:assert/strict')

const http =
  require('node:http')

const express =
  require('express')

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }

      resolve()
    })
  })
}

function createSupabaseStub(requests) {
  return http.createServer((req, res) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      requests.push({
        method:
          req.method,
        url:
          req.url,
        body:
          body ? JSON.parse(body) : null
      })

      res.statusCode = req.url.startsWith('/rest/v1/subscriptions')
        ? 201
        : 200
      res.setHeader('content-type', 'application/json')
      res.end('[]')
    })
  })
}

async function request(serverPort, payload) {
  const response =
    await fetch(`http://127.0.0.1:${serverPort}/subscriptions`, {
      method:
        'POST',
      headers: {
        'content-type':
          'application/json'
      },
      body:
        JSON.stringify(payload)
    })

  return {
    status:
      response.status,
    body:
      await response.json()
  }
}

(async () => {
  const supabaseRequests = []
  const supabaseStub =
    createSupabaseStub(supabaseRequests)
  const supabasePort =
    await listen(supabaseStub)

  process.env.SUPABASE_URL =
    `http://127.0.0.1:${supabasePort}`
  process.env.SUPABASE_ANON_KEY =
    'test-anon-key'

  const subscriptionRoutes =
    require('../routes/subscriptionRoutes')

  const app =
    express()

  app.use(express.json())
  app.use('/', subscriptionRoutes)

  const appServer =
    http.createServer(app)
  const appPort =
    await listen(appServer)

  try {
    const parsedOutput = {
      success:
        true,
      type:
        'subscription',
      serviceName:
        'Netflix',
      amount:
        249,
      renewalDay:
        28,
      renewalMonth:
        null,
      recurrence:
        'monthly'
    }

    const created =
      await request(appPort, {
        userPhone:
          '15551234567',
        parsed:
          parsedOutput
      })

    assert.equal(created.status, 201)
    assert.equal(created.body.success, true)
    assert.deepEqual(created.body.subscription, {
      user_phone:
        '15551234567',
      service_name:
        'Netflix',
      amount:
        249,
      renewal_day:
        28,
      renewal_month:
        null,
      recurrence:
        'monthly'
    })

    assert.equal(supabaseRequests.length, 1)
    assert.equal(supabaseRequests[0].method, 'POST')
    assert.ok(
      supabaseRequests[0].url.startsWith('/rest/v1/subscriptions')
    )
    assert.deepEqual(supabaseRequests[0].body, [
      created.body.subscription
    ])

    const invalid =
      await request(appPort, {
        userPhone:
          '15551234567',
        parsed: {
          success:
            false,
          type:
            'incomplete',
          amount:
            249
        }
      })

    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.success, false)
    assert.equal(supabaseRequests.length, 1)

    console.log(
      'Subscription integration tests passed: 2'
    )
  } finally {
    await close(appServer)
    await close(supabaseStub)
  }
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
