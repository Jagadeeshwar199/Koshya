require('dotenv').config()

const express =
  require('express')

const webhookRoutes =
  require('./routes/webhookRoutes')

const {
  startScheduler
} = require('./services/schedulerService')

const app = express()

app.use(express.json())

app.use('/', webhookRoutes)

/*
========================================
START SCHEDULER
========================================
*/

startScheduler()

const PORT =
  process.env.PORT || 3000

app.listen(PORT, () => {

  console.log(
    `🚀 Koshya running on ${PORT}`
  )
})