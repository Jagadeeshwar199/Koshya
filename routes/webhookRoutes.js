const express = require('express')

const router = express.Router()

const {
  verifyWebhook,
  handleWebhook
} = require('../controllers/webhookController')

router.get(
  '/webhook',
  verifyWebhook
)

router.post(
  '/webhook',
  handleWebhook
)

module.exports = router