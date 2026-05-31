const express = require('express')
const { parseMessage } = require('../controllers/parseController')

const router = express.Router()

router.post('/', parseMessage)

module.exports = router
