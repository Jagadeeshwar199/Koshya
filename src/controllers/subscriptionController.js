const {
  createSubscriptionFromMessage,
  getUserSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription
} = require('../services/subscriptionService')

async function createSubscription(req, res, next) {
  try {
    const result = await createSubscriptionFromMessage(req.body || {})
    res.status(201).json({
      success: true,
      ...result
    })
  } catch (err) {
    next(err)
  }
}

async function listUserSubscriptions(req, res, next) {
  try {
    const subscriptions = await getUserSubscriptions(req.params.phone)
    res.json({
      success: true,
      subscriptions
    })
  } catch (err) {
    next(err)
  }
}

async function getSubscription(req, res, next) {
  try {
    const subscription = await getSubscriptionById(req.params.id)
    res.json({
      success: true,
      subscription
    })
  } catch (err) {
    next(err)
  }
}

async function editSubscription(req, res, next) {
  try {
    const subscription = await updateSubscription(req.params.id, req.body)
    res.json({
      success: true,
      subscription
    })
  } catch (err) {
    next(err)
  }
}

async function removeSubscription(req, res, next) {
  try {
    const subscription = await deleteSubscription(req.params.id)
    res.json({
      success: true,
      subscription
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createSubscription,
  listUserSubscriptions,
  getSubscription,
  editSubscription,
  removeSubscription
}
