const express = require('express')
const {
  generate,
  pending,
  sent
} = require('../controllers/reminderController')

const router = express.Router()

router.post('/generate', generate)
router.get('/pending', pending)
router.post('/:id/sent', sent)

module.exports = router
