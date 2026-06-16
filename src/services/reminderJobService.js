const supabase = require('../../config/supabase')
const { sendWhatsAppMessage } = require('./whatsappService')
const {
  generateReminders,
  computeNextRenewalDate,
  computeReminderRenewalDate
} = require('./reminderService')
const logger = require('../../utils/logger')
const { displayReminderTitle } = require('../formatters/reminderFormatter')

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
        const { data: claimed, error: claimError } = await supabase
          .from('reminders')
          .update({ status: 'processing' })
          .eq('id', reminder.id)
          .in('status', ['pending', 'failed'])
          .select('*')
          .maybeSingle()

        if (claimError) {
          throw claimError
        }

        if (!claimed) {
          logger.info('reminder.delivery_skipped_already_claimed', {
            reminderId: reminder.id
          })
          continue
        }

        logger.info('reminder.delivery_started', {
          reminderId: claimed.id,
          userPhone: claimed.user_phone,
          scheduledUtc: claimed.trigger_at,
          deliveredUtc: new Date().toISOString()
        })

        const sendResult = await sendWhatsAppMessage(
          claimed.user_phone,
          `⏰ Reminder: ${displayReminderTitle(claimed.message)}`
        )

        if (!sendResult.success) {
          throw new Error(`WhatsApp send failed: ${JSON.stringify(sendResult.error)}`)
        }

        const deliveredAt = new Date()
        const { buildDeliveryUpdate } = require('./recurrenceScheduleService')
        const deliveryPatch = buildDeliveryUpdate(claimed, deliveredAt)

        const { error: sentError } = await supabase
          .from('reminders')
          .update(deliveryPatch)
          .eq('id', claimed.id)
          .eq('status', 'processing')

        if (sentError) {
          throw sentError
        }

        sent++
        logger.info('reminder.delivery_sent', {
          reminderId: claimed.id,
          userPhone: claimed.user_phone,
          nextStatus: deliveryPatch.status,
          nextTriggerAt: deliveryPatch.trigger_at || null
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
          .in('status', ['pending', 'failed', 'processing'])

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
    sent
  })

  return {
    generated: generation.generated,
    skipped: generation.skipped,
    queued: sent,
    sent
  }
}

module.exports = {
  runReminderJob,
  processQueuedReminders,
  isSubscriptionReminderDue,
  computeNextRenewalDate
}
