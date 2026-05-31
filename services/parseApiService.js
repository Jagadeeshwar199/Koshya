const { parseSubscription } = require('./parserService')

function parseSubscriptionInput({ text, pending = null }) {
  if (text === undefined || text === null) {
    return {
      success: false,
      status: 'error',
      error: 'text is required',
      subscription: null,
      draft: null,
      missing: []
    }
  }

  if (typeof text !== 'string' || !text.trim()) {
    return {
      success: false,
      status: 'error',
      error: 'text must be a non-empty string',
      subscription: null,
      draft: null,
      missing: []
    }
  }

  return parseSubscription(text, pending)
}

module.exports = {
  parseSubscriptionInput
}
