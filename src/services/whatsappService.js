const axios = require('axios')
const logger = require('../../utils/logger')

let outboundCapture = null
let activeReplyMessageId = null
const sentMessages = new Set()

function setOutboundCapture(fn) {
  outboundCapture = typeof fn === 'function' ? fn : null
}

function clearOutboundCapture() {
  outboundCapture = null
}

function setActiveReplyMessageId(messageId) {
  activeReplyMessageId = messageId || null
}

function clearActiveReplyMessageId() {
  activeReplyMessageId = null
}

async function sendReplyOnce(messageId, fn) {
  const key = messageId || activeReplyMessageId
  if (!key) return fn()
  if (sentMessages.has(key)) {
    logger.warn('duplicate_reply_blocked', { messageId: key })
    return { success: true, duplicateBlocked: true }
  }
  sentMessages.add(key)
  try {
    return await fn()
  } finally {
    setTimeout(() => sentMessages.delete(key), 5 * 60 * 1000).unref()
  }
}

async function doSend(phone, text) {
  const source = process.env.GUPSHUP_SOURCE_PHONE
  if (!source) {
    logger.error('whatsapp.source_not_configured')
    return { success: false, error: 'GUPSHUP_SOURCE_PHONE is not configured' }
  }
  if (!process.env.GUPSHUP_API_KEY) {
    logger.error('whatsapp.api_key_not_configured')
    return { success: false, error: 'GUPSHUP_API_KEY is not configured' }
  }
  try {
    const response = await axios.post(
      'https://api.gupshup.io/wa/api/v1/msg',
      new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: phone,
        message: JSON.stringify({ type: 'text', text })
      }),
      {
        headers: {
          apikey: process.env.GUPSHUP_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )
    logger.info('whatsapp.message_sent', { destination: phone, status: response.status })
    return { success: true, status: response.status, data: response.data }
  } catch (err) {
    const error = err.response?.data || err.message
    logger.error('whatsapp.send_failed', { destination: phone, error })
    return { success: false, error }
  }
}

async function sendWhatsAppMessage(phone, text) {
  if (outboundCapture) outboundCapture(text)
  return sendReplyOnce(activeReplyMessageId, () => doSend(phone, text))
}

module.exports = {
  sendWhatsAppMessage,
  sendReplyOnce,
  setActiveReplyMessageId,
  clearActiveReplyMessageId,
  setOutboundCapture,
  clearOutboundCapture
}
