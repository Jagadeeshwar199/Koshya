const supabase =
  require('../config/supabase')

const {
  routeWhatsAppMessage
} = require('../src/services/messageRouterService')
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
    INTENT ROUTER
    ========================================
    */

    const result = await routeWhatsAppMessage(sender, text)
    logger.info('webhook.intent_flow_done', {
      userPhone: sender,
      intent: result?.intent,
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