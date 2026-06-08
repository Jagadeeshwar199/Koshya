/**
 * Single response builder — all outbound text passes through here.
 */
const { buildKoshyaResponse } = require('../services/koshyaResponseLayer')
const { sendWhatsAppMessage } = require('../services/whatsappService')

async function buildAndSend(sender, { intent, entities, geminiRaw, execResult, validationOk }) {
  const { text, geminiStored } = buildKoshyaResponse({
    intent,
    entities,
    geminiRaw,
    execResult,
    validationOk
  })
  let replySent = false
  if (text && execResult?.replySent !== true) {
    const reply = await sendWhatsAppMessage(sender, text)
    replySent = reply.success
  } else if (execResult?.replySent) {
    replySent = true
  }
  return { text, geminiStored, replySent }
}

function buildResponse(opts) {
  return buildKoshyaResponse(opts)
}

module.exports = { buildResponse, buildAndSend, buildKoshyaResponse }
