const {
  parseSubscriptionInput
} = require('../services/parseApiService')

const parseSubscriptionMessage = (req, res) => {
  try {
    const { text, pending } = req.body ?? {}
    const result = parseSubscriptionInput({ text, pending })

    if (result.status === 'error') {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('PARSE API ERROR:', error)

    return res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to parse subscription message',
      subscription: null,
      draft: null,
      missing: []
    })
  }
}

module.exports = {
  parseSubscriptionMessage
}
