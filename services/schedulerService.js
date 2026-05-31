const { runSafely } = require('./reminderWorker')

function startScheduler() {
  console.log(
    '✅ Subscription reminders use the 12-hour reminder worker (9 AM & 9 PM IST by default)'
  )

  runSafely().catch((err) => {
    console.log('Startup reminder catch-up failed:', err)
  })
}

module.exports = {
  startScheduler
}
