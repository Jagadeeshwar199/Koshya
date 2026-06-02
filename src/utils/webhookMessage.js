function parseWebhookMessage(body) {
  const meta = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (meta?.type === 'text') {
    return {
      sender: meta.from,
      text: String(meta.text?.body || '').trim(),
      messageId: meta.id
    }
  }

  const gs = body?.payload
  if (body?.type === 'message' && gs) {
    const text =
      gs.type === 'text'
        ? String(gs.payload?.text || gs.payload?.body || '').trim()
        : ''
    return {
      sender: gs.source || gs.sender?.phone,
      text,
      messageId: gs.id || body.messageId
    }
  }

  return null
}

module.exports = { parseWebhookMessage }
