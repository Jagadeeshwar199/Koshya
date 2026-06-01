require('dotenv').config()

const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const webhookRoutes = require('./src/routes/webhookRoutes')
const parseRoutes = require('./src/routes/parseRoutes')
const subscriptionRoutes = require('./src/routes/subscriptionRoutes')
const reminderRoutes = require('./src/routes/reminderRoutes')
const { apiAuth } = require('./src/middleware/apiAuth')
const { requestId } = require('./src/middleware/requestId')
const {
  notFoundHandler,
  errorHandler
} = require('./src/middleware/errorHandler')
const { checkDatabaseHealth } = require('./src/services/healthService')
const { stopReminderWorker } = require('./src/services/reminderWorker')
const logger = require('./utils/logger')

const app = express()

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors(
    corsOrigins.length
      ? { origin: corsOrigins }
      : process.env.NODE_ENV === 'production'
        ? { origin: false }
        : {}
  )
)

app.use(requestId)
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    }
  })
)

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 120),
  standardHeaders: true,
  legacyHeaders: false
})

app.use('/', webhookRoutes)

const apiRouter = express.Router()
apiRouter.use(apiLimiter)
apiRouter.use(apiAuth)
apiRouter.use('/parse', parseRoutes)
apiRouter.use('/subscriptions', subscriptionRoutes)
apiRouter.use('/reminders', reminderRoutes)

app.use('/api/v1', apiRouter)
app.use('/api', apiRouter)

app.get('/', (req, res) => {
  res.send('Koshya backend is running')
})

app.get('/health', async (req, res) => {
  const db = await checkDatabaseHealth()

  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'degraded',
    service: 'koshya',
    time: new Date().toISOString(),
    checks: {
      database: db.ok ? 'ok' : 'error',
      ...(db.error ? { databaseError: db.error } : {})
    }
  })
})

app.use(notFoundHandler)
app.use(errorHandler)

let serverInstance = null

function start() {
  const { startScheduler } = require('./src/services/schedulerService')

  startScheduler()

  const PORT = process.env.PORT || 3000

  serverInstance = app.listen(PORT, () => {
    logger.info('server.started', { port: PORT })
  })

  return serverInstance
}

function shutdown(signal) {
  logger.info('server.shutdown_started', { signal })

  stopReminderWorker()

  if (!serverInstance) {
    process.exit(0)
    return
  }

  serverInstance.close(() => {
    logger.info('server.shutdown_complete', { signal })
    process.exit(0)
  })

  setTimeout(() => {
    logger.error('server.shutdown_forced')
    process.exit(1)
  }, 10000).unref()
}

if (require.main === module) {
  start()
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

module.exports = app
module.exports.start = start
module.exports.shutdown = shutdown
