const cron =
  require('node-cron')

const supabase =
  require('../config/supabase')

const {
  sendWhatsAppMessage
} = require('./whatsappService')

/*
========================================
PREVENT OVERLAPPING RUNS
========================================
*/

let isRunning = false

/*
========================================
START SCHEDULER
========================================
*/

function startScheduler() {

  console.log(
    '✅ Scheduler Started'
  )

  /*
  ========================================
  RUN EVERY MINUTE
  ========================================
  */

  cron.schedule('0 9 * * *', async () => {

    /*console.log(
  '⏰ Daily subscription job started'
)
    ========================================
    PREVENT OVERLAP
    ========================================
    */

    if (isRunning) {

      console.log(
        '⏳ Previous scheduler still running...'
      )

      return
    }

    isRunning = true

    try {

      console.log(
        '⏰ Checking subscriptions...'
      )

      /*
      ========================================
      CURRENT TIME
      ========================================
      */

      const now =
        new Date()

      const currentHour =
        now.getHours()

      const currentMinute =
        now.getMinutes()

      /*
      ========================================
      GET ACTIVE SUBSCRIPTIONS
      ========================================
      */

      const {
        data: subscriptions,
        error
      } = await supabase

        .from('subscriptions')

        .select('*')

        .eq('active', true)

      if (error) {

        console.error(
          '❌ Supabase Error:',
          error
        )

        isRunning = false

        return
      }

      /*
      ========================================
      NO SUBSCRIPTIONS
      ========================================
      */

      if (
        !subscriptions ||
        subscriptions.length === 0
      ) {

        console.log(
          '📭 No subscriptions found'
        )

        isRunning = false

        return
      }

      /*
      ========================================
      LOOP SUBSCRIPTIONS
      ========================================
      */

      for (const sub of subscriptions) {

        try {

          /*
          ========================================
          TEST MODE:
          renewal_month stores timestamp string
          ========================================
          */

          if (!sub.renewal_month) {

            continue
          }

          const renewalDate =
            new Date(sub.renewal_month)

          const renewalHour =
            renewalDate.getHours()

          const renewalMinute =
            renewalDate.getMinutes()

          /*
          ========================================
          MATCH TIME
          ========================================
          */

          const sameHour =
            renewalHour === currentHour

          const sameMinute =
            renewalMinute === currentMinute

          if (
            sameHour &&
            sameMinute
          ) {

            console.log(

              `🚨 Sending reminder for ${sub.service_name}`

            )

            await sendWhatsAppMessage(

              sub.user_phone,

`⚠️ Subscription Reminder

📦 ${sub.service_name}

💰 ₹${sub.amount}

Renewal happening now.`

            )

            console.log(
              `✅ Reminder sent for ${sub.service_name}`
            )
          }

        } catch (subError) {

          console.error(
            '❌ Subscription Loop Error:',
            subError
          )
        }
      }

      /*
      ========================================
      FINISH
      ========================================
      */

      isRunning = false

    } catch (err) {

      console.error(
        '❌ Scheduler Error:',
        err
      )

      isRunning = false
    }
  })
}

module.exports = {
  startScheduler
}