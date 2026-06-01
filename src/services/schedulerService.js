const { runSafely, startReminderWorker } = require('./reminderWorker')
const logger = require('../../utils/logger')

function startScheduler() {
  startReminderWorker()

  logger.info('reminder.scheduler_started', {
    description: 'Subscription reminders use the configured reminder worker'
  })

  runSafely().catch((err) => {
    logger.error('reminder.startup_catchup_failed', {
      error: err.message,
      stack: err.stack
    })
  })
}

module.exports = {
  startScheduler
}
