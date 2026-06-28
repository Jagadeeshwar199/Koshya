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
const { analyzeStatement } = require('../services/bankStatement/detectionService')
const store = require('../services/bankStatement/storeService')
const {
  resolveFileType,
  prepareStatementContent,
  downloadStatementFile
} = require('../services/gupshupMediaService')
const { isApiError } = require('../utils/apiError')
const { isPasswordCancel, isPlausiblePassword } = require('../utils/passwordInput')
const logger = require('../../utils/logger')
const { logExecution } = require('../observability/pipelineLogService')

function logCatch(uploadId, stage, err) {
  logger.error(stage, {
    uploadId,
    stage,
    message: err.message,
    stack: err.stack
  })
}

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

async function sendFileReply(sender, text, uploadId) {
  logger.info('whatsapp.reply_start', {
    uploadId,
    userPhone: sender,
    textLength: String(text || '').length
  })
  try {
    const result = await sendWhatsAppMessage(sender, text)
    if (result?.success === false) {
      logger.error('whatsapp.reply_failed', {
        uploadId,
        stage: 'whatsapp.reply_failed',
        message: String(result.error || 'send_failed'),
        stack: null,
        userPhone: sender
      })
      return result
    }
    logger.info('whatsapp.reply_success', {
      uploadId,
      userPhone: sender,
      duplicateBlocked: Boolean(result?.duplicateBlocked)
    })
    return result
  } catch (err) {
    logCatch(uploadId, 'whatsapp.reply_failed', err)
    throw err
  }
}

async function runStatementAnalysis({ uploadId, sender, fileName, fileType, content, statementId = null, password = null }) {
  logger.info('analysis.input_ready', {
    uploadId,
    userPhone: sender,
    fileType,
    fileName,
    statementId,
    hasPassword: Boolean(password)
  })
  logger.info('analysis.start', { uploadId, userPhone: sender, fileType, fileName, statementId })
  const result = await analyzeStatement({
    userPhone: sender,
    fileName,
    fileType,
    content,
    statementId,
    password,
    uploadId
  })
  logger.info('analysis.success', {
    uploadId,
    userPhone: sender,
    statementId: result.statementId,
    status: result.status,
    transactionCount: result.transactionCount
  })
  await sendFileReply(sender, result.message, uploadId)
  logger.info('webhook.bank_statement_done', {
    uploadId,
    userPhone: sender,
    statementId: result.statementId,
    status: result.status,
    transactionCount: result.transactionCount
  })
  return result
}

async function handleAwaitingPasswordText(sender, statement, text, uploadId, messageId) {
  logger.info('webhook.password_prompt_active', {
    uploadId,
    userPhone: sender,
    statementId: statement.id
  })

  if (isPasswordCancel(text)) {
    await store.clearAwaitingPasswordStatement(statement.id)
    await sendFileReply(
      sender,
      'Password entry cancelled.\n\nUpload your bank statement again when ready.',
      uploadId
    )
    if (messageId) await markMessageProcessed(messageId, sender)
    return
  }

  if (!isPlausiblePassword(text)) {
    await sendFileReply(
      sender,
      "I'm waiting for your PDF password.\n\nSend the password as a single message, or reply cancel to stop.",
      uploadId
    )
    if (messageId) await markMessageProcessed(messageId, sender)
    return
  }

  await handlePasswordRetry(sender, statement, text, uploadId, messageId)
}

async function handlePasswordRetry(sender, statement, password, uploadId, messageId) {
  try {
    await runStatementAnalysis({
      uploadId,
      sender,
      fileName: statement.file_name,
      fileType: statement.file_type,
      content: statement.raw_content,
      statementId: statement.id,
      password: String(password).trim()
    })
  } catch (err) {
    logCatch(uploadId, 'analysis.failed', err)
    logger.error('webhook.bank_statement_failed', {
      uploadId,
      userPhone: sender,
      error: err.message,
      stack: err.stack
    })
    const msg = isApiError(err)
      ? err.message
      : 'Something went wrong processing your statement.\n\nTry again or reply help.'
    await sendFileReply(sender, msg, uploadId)
  }
  if (messageId) {
    await markMessageProcessed(messageId, sender)
  }
}

async function handleBankStatementFile(sender, incoming, uploadId) {
  const { file, messageId } = incoming
  const fileType = resolveFileType(file.name, file.contentType)

  logger.info('webhook.file_metadata', {
    uploadId,
    userPhone: sender,
    messageId,
    name: file.name,
    contentType: file.contentType,
    fileType,
    url: file.url
  })

  if (!fileType) {
    await sendFileReply(
      sender,
      'Unsupported file type.\n\nPlease upload a bank statement as PDF or CSV.',
      uploadId
    )
    return
  }

  const downloaded = await downloadStatementFile(file.url, uploadId)
  if (downloaded.error) {
    await sendFileReply(
      sender,
      'Could not download your file.\n\nPlease try uploading again.',
      uploadId
    )
    return
  }

  const content = prepareStatementContent(downloaded.buffer, fileType)

  try {
    await runStatementAnalysis({ uploadId, sender, fileName: file.name, fileType, content })
  } catch (err) {
    logCatch(uploadId, 'analysis.failed', err)
    logger.error('webhook.bank_statement_failed', {
      uploadId,
      userPhone: sender,
      error: err.message,
      stack: err.stack
    })
    const msg = isApiError(err)
      ? err.message
      : 'Something went wrong processing your statement.\n\nTry again or reply help.'
    await sendFileReply(sender, msg, uploadId)
  }

  if (messageId) {
    await markMessageProcessed(messageId, sender)
  }
}

async function handleWebhook(req, res) {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value
    const statusUpdate = value?.statuses?.[0]

    if (statusUpdate) {
      logger.info('whatsapp.delivery_status', {
        status: statusUpdate.status,
        messageId: statusUpdate.id,
        recipientId: statusUpdate.recipient_id,
        timestamp: statusUpdate.timestamp,
        raw: statusUpdate
      })

      return res.sendStatus(200)
    }

    const incoming = parseWebhookMessage(req.body)
    if (!incoming?.sender) {
      logger.warn('webhook.no_text_message', {
        requestId: req.requestId,
        bodyType: req.body?.type
      })
      return res.sendStatus(200)
    }

    const sender = incoming.sender
    const messageId = incoming.messageId
    const requestId = req.requestId || crypto.randomUUID()

    if (incoming.file?.url) {
      const uploadId = crypto.randomUUID()
      logger.info('webhook.file_received', {
        uploadId,
        requestId,
        userPhone: sender,
        messageId
      })
      if (messageId && (await isMessageProcessed(messageId))) {
        return res.sendStatus(200)
      }

      const label = `[file] ${incoming.file.name || 'upload'}`
      await supabase.from('messages').insert({ user_phone: sender, message: label })

      if (await isFirstMessage(sender)) {
        await sendWhatsAppMessage(sender, WELCOME_TEXT)
      }

      await handleBankStatementFile(sender, incoming, uploadId)
      return res.sendStatus(200)
    }

    if (!incoming.text) {
      logger.warn('webhook.no_text_message', {
        requestId: req.requestId,
        bodyType: req.body?.type
      })
      return res.sendStatus(200)
    }

    const text = incoming.text.replace(/\\+$/, '').trim()

    if (!text) {
      return res.sendStatus(200)
    }

    if (messageId && (await isMessageProcessed(messageId))) {
      return res.sendStatus(200)
    }

    const pendingPassword = await store.findAwaitingPasswordStatement(sender)
    if (pendingPassword) {
      const uploadId = crypto.randomUUID()
      await handleAwaitingPasswordText(sender, pendingPassword, text, uploadId, messageId)
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
      stage: 'webhook.error',
      message: err.message,
      stack: err.stack
    })
    return res.sendStatus(500)
  }
}

module.exports = {
  handleWebhook,
  handleBankStatementFile,
  handleAwaitingPasswordText,
  handlePasswordRetry,
  runStatementAnalysis
}
