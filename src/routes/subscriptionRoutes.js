const express = require('express')
const {
  createSubscription,
  listUserSubscriptions,
  getSubscription,
  editSubscription,
  removeSubscription
} = require('../controllers/subscriptionController')
const { ApiError } = require('../utils/apiError')

const router = express.Router()

function digitsPhoneOnly(req, res, next) {
  if (!/^\d{8,15}$/.test(req.params.phone || '')) {
    return next(new ApiError(404, 'Route not found'))
  }
  return next()
}

router.post('/', createSubscription)
router.get('/id/:id', getSubscription)
router.put('/:id', editSubscription)
router.delete('/:id', removeSubscription)
router.get('/:phone', digitsPhoneOnly, listUserSubscriptions)

module.exports = router
