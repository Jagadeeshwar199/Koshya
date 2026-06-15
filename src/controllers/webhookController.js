const crypto = require('crypto')
const supabase = require('../../config/supabase')
const { routeWhatsAppMessage } = require('../services/messageRouterService')
const {
  isMessageProcessed,
  markMessageProcessed
} = require('../services/webhookIdempotencyService')
const { sendWhatsAppMessage } = require('../services/whatsappService')
const { parseWebhookMessage } = require('../utils/webhookMessage')
const { WELCOME_TEXT } = require('../controllers/queryController')
const logger = require('../../utils/logger')
const { logExecution } = require('../observability/pipelineLogService')

async function isFirstMessage(userPhone) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_phone', userPhone)

  if (error) {
    return false
  }

  return count === 1
}

async function handleWebhook(req, res) {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value
    const statusUpdate = value?.statuses?.[0]

    if (statusUpdate) {
      return res.sendStatus(200)
    }

    const incoming = parseWebhookMessage(req.body)
    if (!incoming?.sender || !incoming.text) {
      logger.warn('webhook.no_text_message', {
        requestId: req.requestId,
        bodyType: req.body?.type
      })
      return res.sendStatus(200)
    }

    const sender = incoming.sender
    const text = incoming.text.replace(/\\+$/, '').trim()
    const messageId = incoming.messageId
    const requestId = req.requestId || crypto.randomUUID()

    if (!text) {
      return res.sendStatus(200)
    }

    await logExecution({
      requestId,
      userId: sender,
      phoneNumber: sender,
      messageId,
      stage: 'WEBHOOK_RECEIVED',
      status: 'INFO',
      event: 'whatsapp_webhook',
      input: { text, messageId }
    })

    if (messageId && (await isMessageProcessed(messageId))) {
      return res.sendStatus(200)
    }

    const { error: messageError } = await supabase.from('messages').insert({
      user_phone: sender,
      message: text
    })

    if (messageError) {
      logger.error('webhook.raw_message_save_failed', { userPhone: sender, error: messageError })
      await logExecution({
        requestId,
        userId: sender,
        phoneNumber: sender,
        messageId,
        stage: 'MESSAGE_SAVED',
        status: 'ERROR',
        event: 'messages_insert',
        error: messageError.message
      })
      return res.sendStatus(500)
    }

    await logExecution({
      requestId,
      userId: sender,
      phoneNumber: sender,
      messageId,
      stage: 'MESSAGE_SAVED',
      status: 'SUCCESS',
      event: 'messages_insert',
      output: { text }
    })

    if (await isFirstMessage(sender)) {
      await sendWhatsAppMessage(sender, WELCOME_TEXT)
    }

    let result
    try {
      result = await routeWhatsAppMessage(sender, text, { requestId, whatsappMessageId: messageId })
    } catch (routeErr) {
      logger.error('webhook.route_failed', {
        userPhone: sender,
        error: routeErr.message,
        stack: routeErr.stack
      })
      await sendWhatsAppMessage(
        sender,
        'Something went wrong.\n\nTry again or reply help.'
      )
      return res.sendStatus(200)
    }

    if (messageId) {
      await markMessageProcessed(messageId, sender)
    }

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

module.exports = { handleWebhook }
