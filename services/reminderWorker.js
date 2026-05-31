const cron = require('node-cron')
const { runReminderJob } = require('./reminderJobService')

const CRON_SCHEDULE =
  process.env.REMINDER_CRON_SCHEDULE || '0 9,21 * * *'

const TIMEZONE =
  process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'

let isRunning = false

async function runSafely() {
  if (isRunning) {
    console.log('Reminder job already running, skipping')
    return
  }

  isRunning = true

  try {
    await runReminderJob()
  } catch (err) {
    console.log('Reminder job crash:', err)
  } finally {
    isRunning = false
  }
}

cron.schedule(CRON_SCHEDULE, runSafely, {
  timezone: TIMEZONE
})

console.log(
  `✅ Reminder worker scheduled (${CRON_SCHEDULE}, ${TIMEZONE}) — every 12 hours`
)

module.exports = { runSafely }
