const supabase = require('../../config/supabase')
const logger = require('../../utils/logger')

async function isMessageProcessed(messageId) {
  if (!messageId) {
    return false
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (error) {
    logger.error('webhook.idempotency_check_failed', { messageId, error })
    throw error
  }

  return Boolean(data)
}

async function markMessageProcessed(messageId, userPhone) {
  if (!messageId) {
    return
  }

  const { error } = await supabase.from('webhook_events').insert({
    message_id: messageId,
    user_phone: userPhone
  })

  if (error?.code === '23505') {
    return
  }

  if (error) {
    logger.error('webhook.idempotency_mark_failed', { messageId, error })
    throw error
  }
}

module.exports = {
  isMessageProcessed,
  markMessageProcessed
}
