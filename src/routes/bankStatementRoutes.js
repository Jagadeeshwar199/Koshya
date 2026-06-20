const express = require('express')
const { analyze, unlock, confirm, feedback, results } = require('../controllers/bankStatementController')

const router = express.Router()

router.post('/analyze', analyze)
router.post('/:id/unlock', unlock)
router.post('/:id/confirm', confirm)
router.post('/:id/feedback', feedback)
router.get('/:id/results', results)

module.exports = router
