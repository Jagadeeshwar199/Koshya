/**
 * entityExtractor.ts (runtime JS) — normalizes entities for shadow planner.
 * EXTENSION: add domain-specific entity keys (e.g. billingAccountId).
 */
const { extractEntities } = require('../intent/entityExtractor')

function extract(message) {
  const e = extractEntities(message)
  const out = {}
  if (e.serviceName) out.serviceName = e.serviceName
  if (e.amount != null) out.amount = e.amount
  if (e.date) out.date = e.date
  if (e.recurrence) out.recurrence = e.recurrence
  if (e.actionText) out.actionText = e.actionText
  if (e.queryType) out.queryType = e.queryType
  return out
}

module.exports = { extract }
