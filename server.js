require('dotenv').config()

const express =
  require('express')

const webhookRoutes =
  require('./routes/webhookRoutes')

const {
  startScheduler
} = require('./services/schedulerService')

/*
========================================
START REMINDER WORKER
========================================
*/

require('./services/reminderWorker')

const app = express()

app.use(express.json())

app.use('/', webhookRoutes)

/*
========================================
HEALTH ROUTE
========================================
*/

app.get('/health', (req, res) => {

  res.json({

    status: 'ok',

    service: 'koshya',

    time: new Date()

  })

})

/*
========================================
START SCHEDULER
========================================
*/

startScheduler()

/*
========================================
START SERVER
========================================
*/

const PORT =
  process.env.PORT || 3000

app.listen(PORT, () => {

  console.log(
    `🚀 Koshya running on ${PORT}`
  )

})