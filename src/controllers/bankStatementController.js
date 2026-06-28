const {
  analyzeStatement,
  unlockStatement,
  confirmStatement,
  submitFeedback,
  formatResultsMessage
} = require('../services/bankStatement/detectionService')
const store = require('../services/bankStatement/storeService')
const { ApiError } = require('../utils/apiError')
const logger = require('../../utils/logger')

function validatePhone(userPhone) {
  if (!userPhone || !/^\d{8,15}$/.test(String(userPhone))) {
    throw new ApiError(400, 'userPhone is required (8-15 digits)')
  }
}

async function analyze(req, res, next) {
  try {
    const { userPhone, fileName, fileType = 'csv', content } = req.body || {}
    logger.info('bank_statement.debug.request_received', {
      userPhone,
      fileName,
      fileType,
      contentLength: content ? String(content).length : 0
    })
    validatePhone(userPhone)
    if (!content || !String(content).trim()) {
      throw new ApiError(400, 'content is required')
    }
    const result = await analyzeStatement({ userPhone, fileName, fileType, content })
    const code = result.status === 'duplicate' ? 200 : 201
    logger.info('bank_statement.debug.response', {
      statementId: result.statementId,
      status: result.status,
      httpStatus: code
    })
    res.status(code).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

async function unlock(req, res, next) {
  try {
    const { userPhone, password } = req.body || {}
    validatePhone(userPhone)
    const result = await unlockStatement({ statementId: req.params.id, userPhone, password })
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

async function confirm(req, res, next) {
  try {
    const { userPhone, resultIds } = req.body || {}
    validatePhone(userPhone)
    const result = await confirmStatement({ statementId: req.params.id, userPhone, resultIds })
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

async function feedback(req, res, next) {
  try {
    const { userPhone, resultId, correction } = req.body || {}
    validatePhone(userPhone)
    const result = await submitFeedback({
      statementId: req.params.id,
      userPhone,
      resultId,
      correction: correction || {}
    })
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

async function results(req, res, next) {
  try {
    const rows = await store.getResults(req.params.id)
    res.json({
      success: true,
      statementId: req.params.id,
      subscriptions: rows,
      message: formatResultsMessage(
        rows.map((r) => ({
          serviceName: r.service_name,
          amount: r.amount,
          recurrence: r.recurrence,
          confidence: r.confidence
        }))
      )
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { analyze, unlock, confirm, feedback, results }
