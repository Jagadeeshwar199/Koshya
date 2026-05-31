const { isApiError } = require('../utils/apiError')
const logger = require('../../utils/logger')

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  })
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  if (isApiError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details
    })
  }

  logger.error('api.unhandled_error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  })

  return res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
}

module.exports = {
  notFoundHandler,
  errorHandler
}
