const {
  createSubscription
} = require('../services/subscriptionService')

async function createSubscriptionController(
  req,
  res
) {
  const result =
    await createSubscription(req.body || {})

  if (!result.success) {
    return res
      .status(result.status || 500)
      .json({
        success: false,
        error:
          result.error
      })
  }

  return res
    .status(201)
    .json({
      success: true,
      subscription:
        result.subscription
    })
}

module.exports = {
  createSubscriptionController
}
