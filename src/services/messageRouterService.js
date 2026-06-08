/**
 * Thin adapter — delegates to core/processMessage (single entry point).
 */
const { processMessage } = require('../core/processMessage')
const { routeToFlow } = require('../core/router')

async function routeWhatsAppMessage(sender, text, options = {}) {
  return processMessage(sender, text, options)
}

async function routeDetectedIntent(sender, text, intent, options = {}, meta = {}) {
  return routeToFlow(sender, text, intent, options, meta)
}

module.exports = {
  routeWhatsAppMessage,
  routeDetectedIntent
}
