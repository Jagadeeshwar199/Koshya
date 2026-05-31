const { parseMessage } = require('../../services/parserService')
const { ApiError } = require('../utils/apiError')

function validateMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'message is required and must be a non-empty string')
  }

  return message.trim()
}

async function parseSubscriptionMessage(message, pending = null) {
  const normalizedMessage = validateMessage(message)
  return parseMessage(normalizedMessage, pending)
}

module.exports = {
  parseSubscriptionMessage,
  validateMessage
}
