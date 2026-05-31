const { parseSubscriptionMessage } = require('../services/parserService')

async function parseMessage(req, res, next) {
  try {
    const parsed = await parseSubscriptionMessage(req.body?.message)
    res.json(parsed)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  parseMessage
}
