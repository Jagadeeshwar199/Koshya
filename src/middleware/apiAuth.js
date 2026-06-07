const crypto = require('crypto')
const { ApiError } = require('../utils/apiError')
const logger = require('../../utils/logger')

function apiAuth(req, res, next) {
  const apiKey = process.env.API_KEY

  if (!apiKey) {
    const allowUnauthenticated = process.env.ALLOW_UNAUTHENTICATED === 'true'
    const allowed = allowUnauthenticated || process.env.NODE_ENV !== 'production'
    logger.warn('api.auth_key_not_configured', {
      allow_unauthenticated: allowUnauthenticated,
      allowed
    })
    if (allowed) return next()
    return next(new ApiError(503, 'API authentication is not configured'))
  }

  const provided =
    req.get('x-api-key') ||
    req.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!provided) {
    return next(new ApiError(401, 'API key is required'))
  }

  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(apiKey)

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return next(new ApiError(401, 'Invalid API key'))
  }

  return next()
}

module.exports = {
  apiAuth
}
