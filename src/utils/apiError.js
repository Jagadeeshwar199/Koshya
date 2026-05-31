class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
  }
}

function isApiError(error) {
  return error instanceof ApiError
}

module.exports = {
  ApiError,
  isApiError
}
