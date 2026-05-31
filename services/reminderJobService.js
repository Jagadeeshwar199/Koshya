const supabase = require('../config/supabase')
const { sendWhatsAppMessage } = require('./whatsappService')
const {
  generateReminders,
  computeNextRenewalDate,
  computeReminderRenewalDate
} = require('../src/services/reminderService')
const logger = require('../utils/logger')

function isSubscriptionReminderDue(sub, fromDate = new Date()) {
  return Boolean(
    computeReminderRenewalDate(
      sub,
      fromDate,
      Number(process.env.REMINDER_CATCH_UP_DAYS || 7)
    )
  )
}

async function processQueuedReminders() {
  const now = new Date().toISOString()
  let sent = 0

  while (true) {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('trigger_at', now)
      .lt('retry_count', 3)
      .order('trigger_at', { ascending: true })
      .limit(50)

    if (error) {
      logger.error('reminder.queue_fetch_failed', { error })
      break
    }

    if (!data?.length) {
      break
    }

    for (const reminder of data) {
      try {
        logger.info('reminder.delivery_started', {
          reminderId: reminder.id,
          userPhone: reminder.user_phone
        })

        const { error: processingError } = await supabase
          .from('reminders')
          .update({ status: 'processing' })
          .eq('id', reminder.id)

        if (processingError) {
          throw processingError
        }

        const sendResult = await sendWhatsAppMessage(
          reminder.user_phone,
          `⏰ Reminder: ${reminder.message}`
        )

        if (!sendResult.success) {
          throw new Error(`WhatsApp send failed: ${JSON.stringify(sendResult.error)}`)
        }

        const { error: sentError } = await supabase
          .from('reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id)

        if (sentError) {
          throw sentError
        }

        sent++
        logger.info('reminder.delivery_sent', {
          reminderId: reminder.id,
          userPhone: reminder.user_phone
        })
      } catch (err) {
        logger.error('reminder.delivery_failed', {
          reminderId: reminder.id,
          error: err.message || err
        })

        const { error: failedError } = await supabase
          .from('reminders')
          .update({
            status: 'failed',
            retry_count: (reminder.retry_count || 0) + 1
          })
          .eq('id', reminder.id)

        if (failedError) {
          logger.error('reminder.failure_mark_failed', {
            reminderId: reminder.id,
            error: failedError
          })
        }
      }
    }

    if (data.length < 50) {
      break
    }
  }

  return sent
}

async function runReminderJob() {
  logger.info('reminder.job_started')

  const generation = await generateReminders({
    daysAhead: Number(process.env.REMINDER_LOOKAHEAD_DAYS || 1),
    catchUpDays: Number(process.env.REMINDER_CATCH_UP_DAYS || 7)
  })
  const sent = await processQueuedReminders()

  logger.info('reminder.job_done', {
    generated: generation.generated,
    skipped: generation.skipped,
    queued: sent,
    subscriptions: generation.generated,
    sent
  })

  return {
    generated: generation.generated,
    skipped: generation.skipped,
    queued: sent,
    subscriptions: generation.generated,
    sent
  }
}

module.exports = {
  runReminderJob,
  processQueuedReminders,
  isSubscriptionReminderDue,
  computeNextRenewalDate
}
