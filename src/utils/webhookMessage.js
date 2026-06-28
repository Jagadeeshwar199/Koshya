function parseGupshupFile(gs) {
  if (gs?.type !== 'file' || !gs.payload?.url) return null
  return {
    url: gs.payload.url,
    name: gs.payload.name || gs.payload.fileName || 'statement',
    contentType: gs.payload.contentType || gs.payload['content-type'] || ''
  }
}

function parseWebhookMessage(body) {
  const meta = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (meta?.type === 'text') {
    return {
      sender: meta.from,
      text: String(meta.text?.body || '').trim(),
      messageId: meta.id
    }
  }
  if (meta?.type === 'document' && meta.document) {
    return {
      sender: meta.from,
      messageId: meta.id,
      file: {
        url: meta.document.link || meta.document.url || '',
        name: meta.document.filename || meta.document.caption || 'statement',
        contentType: meta.document.mime_type || ''
      }
    }
  }

  const gs = body?.payload
  if (body?.type === 'message' && gs) {
    const file = parseGupshupFile(gs)
    if (file) {
      return {
        sender: gs.source || gs.sender?.phone,
        messageId: gs.id || body.messageId,
        file
      }
    }
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

module.exports = { parseWebhookMessage, parseGupshupFile }
