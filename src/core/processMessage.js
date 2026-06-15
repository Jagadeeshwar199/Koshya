/**
 * Single entry point:
 * Message → Parser → normalizeEvent() → Flow Router → Flow → Response → Analytics
 */
const crypto = require('crypto')
const intentPipeline = require('../services/intentPipelineService')
const { parseAdminCommand, handleParserAdminCommand, isAdminPhone } = require('../services/parserTelemetryService')
const { parseMessage } = require('./parser')
const { normalizeEvent } = require('./normalizer')
const { routeMessage } = require('./router')
const { logExecution } = require('./analytics')

async function processMessage(sender, rawMessage, options = {}) {
  const adminCmd = parseAdminCommand(rawMessage)
  if (adminCmd && isAdminPhone(sender)) {
    return handleParserAdminCommand(sender, adminCmd)
  }

  return intentPipeline.runPipeline(
    sender,
    rawMessage,
    async (ctx) => {
      const parseResult = await parseMessage(rawMessage, { ctx })
      const event = normalizeEvent(parseResult)
      ctx.normalizedEvent = event
      ctx.parseResult = parseResult

      const result = await routeMessage(sender, rawMessage, options, ctx, parseResult)
      await logExecution(ctx, { rawMessage, parseResult, result })
      return result
    },
    { requestId: options.requestId || crypto.randomUUID(), whatsappMessageId: options.whatsappMessageId }
  )
}

module.exports = { processMessage }
