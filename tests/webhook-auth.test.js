const assert = require('node:assert/strict')

process.env.NODE_ENV = 'production'
process.env.WEBHOOK_SECRET = 'test-webhook-secret'

const crypto = require('crypto')
const { verifyWebhookSignature } = require('../src/middleware/webhookAuth')

function runMiddleware(req) {
  return new Promise((resolve, reject) => {
    verifyWebhookSignature(req, {}, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

async function run() {
  const body = JSON.stringify({ entry: [] })
  const signature = `sha256=${crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`

  await runMiddleware({
    requestId: 'test',
    rawBody: body,
    body: JSON.parse(body),
    get: (header) =>
      header === 'x-hub-signature-256' ? signature : undefined
  })

  await assert.rejects(
    () =>
      runMiddleware({
        requestId: 'test',
        rawBody: body,
        body: JSON.parse(body),
        get: () => undefined
      }),
    (err) => err.statusCode === 401
  )

  delete process.env.WEBHOOK_SECRET
  await assert.rejects(
    () =>
      runMiddleware({
        requestId: 'test',
        rawBody: body,
        body: JSON.parse(body),
        get: () => signature
      }),
    (err) => err.statusCode === 503
  )

  console.log('Webhook auth tests passed: 3')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
