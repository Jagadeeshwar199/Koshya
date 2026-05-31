const express = require('express')

const router = express.Router()

const {
  parseSubscriptionMessage
} = require('../controllers/parseController')

router.post('/api/parse', parseSubscriptionMessage)

module.exports = router
