const crypto = require('crypto')
const { ApiError } = require('../utils/apiError')
const logger = require('../../utils/logger')

const signatureStats = {
  checked: 0,
  present: 0,
  missing: 0,
  valid: 0,
  invalid: 0
}

function trackSignature(present, valid) {
  signatureStats.checked += 1
  if (present) signatureStats.present += 1
  else signatureStats.missing += 1
  if (valid === true) signatureStats.valid += 1
  if (valid === false) signatureStats.invalid += 1
  logger.info('webhook.signature_check', {
    signature_present: present,
    signature_valid: valid,
    counts: { ...signatureStats }
  })
}

function verifyWebhookGet(req, res) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN

  if (!expectedToken) {
    logger.warn('webhook.verify_token_not_configured')
    return res.status(503).send('Webhook verification is not configured')
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    logger.info('webhook.verified')
    return res.status(200).send(challenge)
  }

  logger.warn('webhook.verification_failed', {
    mode,
    hasToken: Boolean(token)
  })

  return res.status(403).send('Forbidden')
}

function verifyWebhookSignature(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('webhook.secret_not_configured')
      return next(new ApiError(503, 'WEBHOOK_SECRET is not configured'))
    }

    logger.warn('webhook.secret_skipped_in_dev')
    trackSignature(Boolean(req.get('x-hub-signature-256') || req.get('x-gupshup-signature')), null)
    return next()
  }

  const signature =
    req.get('x-hub-signature-256') ||
    req.get('x-gupshup-signature')

  if (!signature) {
    trackSignature(false, null)
    const hasInboundMessage = Boolean(
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ||
      (req.body?.type === 'message' && req.body?.payload)
    )

    if (hasInboundMessage || process.env.WEBHOOK_ALLOW_UNSIGNED === 'true') {
      logger.warn('webhook.unsigned_allowed', {
        requestId: req.requestId,
        hasInboundMessage
      })
      return next()
    }

    logger.warn('webhook.missing_signature', { requestId: req.requestId })
    return next(new ApiError(401, 'Missing webhook signature'))
  }

  const rawBody = req.rawBody || JSON.stringify(req.body)
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`

  const provided = signature.startsWith('sha256=')
    ? signature
    : `sha256=${signature}`

  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    trackSignature(true, false)
    logger.warn('webhook.invalid_signature', { requestId: req.requestId })
    return next(new ApiError(401, 'Invalid webhook signature'))
  }

  trackSignature(true, true)
  return next()
}

module.exports = {
  verifyWebhookGet,
  verifyWebhookSignature,
  signatureStats
}
