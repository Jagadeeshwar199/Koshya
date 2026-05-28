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
REMINDER WORKER
========================================
*/

cron.schedule('* * * * *', async () => {

  /*
  ========================================
  PREVENT DOUBLE RUNS
  ========================================
  */

  if (isRunning) {

    console.log(
      'Reminder worker already running'
    )

    return
  }

  isRunning = true

  console.log(
    'Checking pending reminders...'
  )

  try {

    const now =
      new Date().toISOString()

    /*
    ========================================
    FETCH PENDING REMINDERS
    ========================================
    */

    const { data, error } =
      await supabase

        .from('reminders')

        .select('*')

        .eq('status', 'pending')

        .lte('trigger_at', now)

        .limit(20)

    if (error) {

      console.log(
        'Fetch Error:',
        error
      )

      return
    }

    /*
    ========================================
    PROCESS REMINDERS
    ========================================
    */

    for (const reminder of data) {

      try {

        console.log(
          'Processing reminder:',
          reminder.id
        )

        /*
        ========================================
        LOCK REMINDER
        ========================================
        */

        await supabase

          .from('reminders')

          .update({
            status: 'processing'
          })

          .eq('id', reminder.id)

        /*
        ========================================
        SEND WHATSAPP MESSAGE
        ========================================
        */

        await sendWhatsAppMessage(

          reminder.user_phone,

          `⏰ Reminder: ${reminder.message}`

        )

        /*
        ========================================
        MARK AS SENT
        ========================================
        */

        await supabase

          .from('reminders')

          .update({

            status: 'sent',

            sent_at:
              new Date().toISOString()

          })

          .eq('id', reminder.id)

        console.log(
          'Reminder sent:',
          reminder.id
        )

      } catch (err) {

        console.log(
          'Reminder Failed:',
          err
        )

        /*
        ========================================
        MARK AS FAILED
        ========================================
        */

        await supabase

          .from('reminders')

          .update({

            status: 'failed',

            retry_count:
              reminder.retry_count + 1

          })

          .eq('id', reminder.id)

      }

    }

  } catch (err) {

    console.log(
      'Worker Crash:',
      err
    )

  } finally {

    isRunning = false
  }

})