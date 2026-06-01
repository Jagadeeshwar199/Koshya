const supabase = require('../../config/supabase')
const {
  routeWhatsAppMessage
} = require('../services/messageRouterService')
const {
  isMessageProcessed,
  markMessageProcessed
} = require('../services/webhookIdempotencyService')
const logger = require('../../utils/logger')

async function handleWebhook(req, res) {
  try {
    logger.info('webhook.received', {
      requestId: req.requestId,
      hasEntry: Boolean(req.body?.entry?.length)
    })

    const value =
      req.body.entry?.[0]
        ?.changes?.[0]
        ?.value

    const statusUpdate = value?.statuses?.[0]

    if (statusUpdate) {
      logger.info('webhook.status_event', {
        requestId: req.requestId,
        status: statusUpdate.status
      })

      return res.sendStatus(200)
    }

    const incomingMessage = value?.messages?.[0]

    if (!incomingMessage) {
      return res.sendStatus(200)
    }

    if (incomingMessage.type !== 'text') {
      return res.sendStatus(200)
    }

    const sender = incomingMessage.from
    const text = (incomingMessage.text?.body || '').trim()
    const messageId = incomingMessage.id

    if (!sender || !text) {
      logger.warn('webhook.invalid_text_message', {
        requestId: req.requestId,
        hasSender: Boolean(sender),
        hasText: Boolean(text)
      })
      return res.sendStatus(200)
    }

    if (await isMessageProcessed(messageId)) {
      logger.info('webhook.duplicate_skipped', {
        requestId: req.requestId,
        messageId,
        userPhone: sender
      })
      return res.sendStatus(200)
    }

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
        requestId: req.requestId,
        userPhone: sender,
        error: messageError
      })
      return res.sendStatus(500)
    }

    await markMessageProcessed(messageId, sender)

    const result = await routeWhatsAppMessage(sender, text)
    logger.info('webhook.intent_flow_done', {
      requestId: req.requestId,
      userPhone: sender,
      intent: result?.intent,
      ok: result?.ok,
      replySent: result?.replySent
    })
    return res.sendStatus(200)
  } catch (err) {
    logger.error('webhook.error', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack
    })

    return res.sendStatus(500)
  }
}

module.exports = {
  handleWebhook
}
