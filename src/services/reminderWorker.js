const cron = require('node-cron')
const { runReminderJob } = require('./reminderJobService')
const logger = require('../../utils/logger')

const CRON_SCHEDULE =
  process.env.REMINDER_CRON_SCHEDULE || '* * * * *'

const TIMEZONE =
  process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'

let isRunning = false
let scheduledTask = null

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

function startReminderWorker() {
  if (scheduledTask) {
    return scheduledTask
  }

  scheduledTask = cron.schedule(CRON_SCHEDULE, runSafely, {
    timezone: TIMEZONE
  })

  logger.info('reminder.worker_scheduled', {
    schedule: CRON_SCHEDULE,
    timezone: TIMEZONE
  })

  return scheduledTask
}

function stopReminderWorker() {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('reminder.worker_stopped')
  }
}

async function stopReminderWorkerGracefully(maxMs = 5000) {
  stopReminderWorker()
  const deadline = Date.now() + maxMs
  while (isRunning && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (isRunning) {
    logger.warn('reminder.worker_stop_timeout')
  }
}

module.exports = {
  runSafely,
  startReminderWorker,
  stopReminderWorker,
  stopReminderWorkerGracefully
}
