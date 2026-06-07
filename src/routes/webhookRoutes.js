const express = require('express')
const rateLimit = require('express-rate-limit')
const { handleWebhook } = require('../controllers/webhookController')
const {
  verifyWebhookGet,
  verifyWebhookSignature
} = require('../middleware/webhookAuth')

const router = express.Router()

const webhookJson = express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString()
  }
})

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || 300),
  standardHeaders: true,
  legacyHeaders: false
})

router.get('/webhook', verifyWebhookGet)
router.post('/webhook', webhookLimiter, webhookJson, verifyWebhookSignature, handleWebhook)

module.exports = router
