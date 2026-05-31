const express =
  require('express')

const {
  createSubscriptionController
} = require('../controllers/subscriptionController')

const router =
  express.Router()

router.post(
  '/subscriptions',
  createSubscriptionController
)

module.exports =
  router
