require('dotenv').config()

const express = require('express')
const cors = require('cors')

const webhookRoutes = require('./routes/webhookRoutes')
const parseRoutes = require('./src/routes/parseRoutes')
const subscriptionRoutes = require('./src/routes/subscriptionRoutes')
const reminderRoutes = require('./src/routes/reminderRoutes')
const {
  notFoundHandler,
  errorHandler
} = require('./src/middleware/errorHandler')

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/', webhookRoutes)
app.use('/api/parse', parseRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/reminders', reminderRoutes)

/*
========================================
ROOT ROUTE
========================================
*/

app.get('/', (req, res) => {
  res.send('Koshya backend is running 🚀')
})

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
ERROR HANDLING
========================================
*/

app.use(notFoundHandler)
app.use(errorHandler)

/*
========================================
START SERVER
========================================
*/

function start() {
  const {
    startScheduler
  } = require('./services/schedulerService')

  startScheduler()

  const PORT =
    process.env.PORT || 3000

  return app.listen(PORT, () => {

    console.log(
      `🚀 Koshya running on ${PORT}`
    )

  })
}

if (require.main === module) {
  start()
}

module.exports = app
module.exports.start = start