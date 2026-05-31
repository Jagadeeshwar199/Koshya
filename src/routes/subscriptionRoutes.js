const express = require('express')
const {
  createSubscription,
  listUserSubscriptions,
  getSubscription,
  editSubscription,
  removeSubscription
} = require('../controllers/subscriptionController')

const router = express.Router()

router.post('/', createSubscription)
router.get('/id/:id', getSubscription)
router.get('/:phone', listUserSubscriptions)
router.put('/:id', editSubscription)
router.delete('/:id', removeSubscription)

module.exports = router
