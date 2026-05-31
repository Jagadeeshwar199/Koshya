const cron = require('node-cron')
const { runReminderJob } = require('./reminderJobService')
const logger = require('../utils/logger')

const CRON_SCHEDULE =
  process.env.REMINDER_CRON_SCHEDULE || '0 9,21 * * *'

const TIMEZONE =
  process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'

let isRunning = false

async function runSafely() {
  if (isRunning) {
    logger.warn('reminder.job_already_running')
    return
  }

  isRunning = true

  try {
    await runReminderJob()
  } catch (err) {
    logger.error('reminder.job_crashed', {
      error: err.message,
      stack: err.stack
    })
  } finally {
    isRunning = false
  }
}

cron.schedule(CRON_SCHEDULE, runSafely, {
  timezone: TIMEZONE
})

logger.info('reminder.worker_scheduled', {
  schedule: CRON_SCHEDULE,
  timezone: TIMEZONE
})

module.exports = { runSafely }
