const supabase =
  require('../config/supabase')

const {
  handleSubscriptionMessage
} = require('../services/subscriptionFlowService')

const {
  sendWhatsAppMessage
} = require('../services/whatsappService')
const logger = require('../utils/logger')

/*
========================================
VERIFY WEBHOOK
========================================
*/

const verifyWebhook = (
  req,
  res
) => {

  res
    .status(200)
    .send('Webhook live')
}

/*
========================================
HANDLE WEBHOOK
========================================
*/

const handleWebhook = async (
  req,
  res
) => {

  try {

    /*
    ========================================
    FULL PAYLOAD LOG
    ========================================
    */

    logger.info('webhook.received', {
      hasEntry: Boolean(req.body?.entry?.length)
    })

    const value =
      req.body.entry?.[0]
        ?.changes?.[0]
        ?.value

    /*
    ========================================
    STATUS EVENTS
    ========================================
    */

    const statusUpdate =
      value?.statuses?.[0]

    if (statusUpdate) {

      logger.info('webhook.status_event', {
        status: statusUpdate.status
      })

      return res.sendStatus(200)
    }

    /*
    ========================================
    MESSAGE
    ========================================
    */

    const incomingMessage =
      value?.messages?.[0]

    if (!incomingMessage) {

      return res.sendStatus(200)
    }

    /*
    ========================================
    TEXT ONLY
    ========================================
    */

    if (incomingMessage.type !== 'text') {

      return res.sendStatus(200)
    }

    const sender =
      incomingMessage.from

    const text = (
      incomingMessage.text?.body || ''
    ).trim()

    if (!sender || !text) {
      logger.warn('webhook.invalid_text_message', {
        hasSender: Boolean(sender),
        hasText: Boolean(text)
      })
      return res.sendStatus(200)
    }

    logger.info('webhook.text_message', {
      userPhone: sender,
      messageLength: text.length
    })

    /*
    ========================================
    SAVE RAW MESSAGE
    ========================================
    */

    const { error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          user_phone: sender,
          message: text
        }
      ])

    if (messageError) {
      logger.error('webhook.raw_message_save_failed', {
        userPhone: sender,
        error: messageError
      })
      return res.sendStatus(500)
    }

    /*
    ========================================
    HI FLOW
    ========================================
    */

    const lowerText =
      text.toLowerCase().trim()

    if (
      lowerText === 'hi' ||
      lowerText === 'hello'
    ) {

      const reply = await sendWhatsAppMessage(

        sender,

`👋 Welcome to Koshya

I help you remember subscription renewals.

Send subscriptions like this:

Netflix renews on 28th every month - 249

JioHotstar renews on Jan 12 every 3 months - 599

Prime renews on Jan 20 every year - 1499`

      )

      logger.info('webhook.welcome_reply', {
        userPhone: sender,
        replySent: reply.success
      })

      return res.sendStatus(200)
    }

    /*
    ========================================
    PARSE MESSAGE
    ========================================
    */

    const result = await handleSubscriptionMessage(sender, text)
    logger.info('webhook.subscription_flow_done', {
      userPhone: sender,
      ok: result?.ok,
      replySent: result?.replySent
    })
    return res.sendStatus(200)

  } catch (err) {

    logger.error('webhook.error', {
      error: err.message,
      stack: err.stack
    })

    return res.sendStatus(500)
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook
}