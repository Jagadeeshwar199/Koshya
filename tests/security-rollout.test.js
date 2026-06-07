#!/usr/bin/env node
const assert = require('node:assert/strict')
const crypto = require('crypto')

process.env.NODE_ENV = 'production'
process.env.WEBHOOK_SECRET = 'test-webhook-secret'

const { verifyWebhookSignature, signatureStats } = require('../src/middleware/webhookAuth')
const { apiAuth } = require('../src/middleware/apiAuth')

function runMiddleware(fn, req) {
  return new Promise((resolve, reject) => {
    fn(req, {}, (err) => (err ? reject(err) : resolve()))
  })
}

async function run() {
  const body = JSON.stringify({ entry: [] })
  const signature = `sha256=${crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(body).digest('hex')}`
  const before = { ...signatureStats }

  await runMiddleware(verifyWebhookSignature, {
    requestId: 't1',
    rawBody: body,
    body: JSON.parse(body),
    get: (h) => (h === 'x-hub-signature-256' ? signature : undefined)
  })
  assert.equal(signatureStats.checked, before.checked + 1)
  assert.equal(signatureStats.valid, before.valid + 1)
  assert.equal(signatureStats.present, before.present + 1)

  await assert.rejects(
    () =>
      runMiddleware(verifyWebhookSignature, {
        requestId: 't2',
        rawBody: body,
        body: JSON.parse(body),
        get: (h) => (h === 'x-hub-signature-256' ? 'sha256=bad' : undefined)
      }),
    (err) => err.statusCode === 401
  )
  assert.equal(signatureStats.invalid, before.invalid + 1)

  delete process.env.API_KEY
  delete process.env.ALLOW_UNAUTHENTICATED
  process.env.NODE_ENV = 'development'
  await runMiddleware(apiAuth, { get: () => undefined })
  process.env.NODE_ENV = 'production'
  process.env.ALLOW_UNAUTHENTICATED = 'true'
  await runMiddleware(apiAuth, { get: () => undefined })

  process.env.API_KEY = 'secret-key'
  await assert.rejects(
    () => runMiddleware(apiAuth, { get: () => undefined }),
    (err) => err.statusCode === 401
  )
  await runMiddleware(apiAuth, { get: (h) => (h === 'x-api-key' ? 'secret-key' : undefined) })

  require.cache[require.resolve('../config/supabase')] = {
    exports: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'db down' } })
          })
        })
      })
    }
  }
  delete require.cache[require.resolve('../src/services/webhookIdempotencyService')]
  const { isMessageProcessed } = require('../src/services/webhookIdempotencyService')
  assert.equal(await isMessageProcessed('msg-1'), true)

  console.log('Security rollout tests passed: 6')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
