/**
 * executionPlanner.ts (runtime JS) — decides if shadow path could execute (not used in prod).
 * EXTENSION: per-domain required field tables and validators.
 */
const { Domain, Action } = require('./types')

function plan(domain, action, entities) {
  const missingFields = []
  const reasons = [`plan:${domain}+${action}`]

  if (domain === Domain.UNKNOWN || action === Action.UNKNOWN) {
    return { canExecute: false, missingFields: ['domain_or_action'], reasons: [...reasons, 'unknown'] }
  }
  if (action === Action.HELP || action === Action.QUERY || action === Action.LIST) {
    return { canExecute: true, missingFields: [], reasons }
  }

  if (domain === Domain.REMINDER && action === Action.CREATE) {
    if (!entities.actionText && !entities.serviceName) missingFields.push('subject')
    if (!entities.date) missingFields.push('date')
  }
  if (domain === Domain.SUBSCRIPTION && action === Action.CREATE) {
    if (!entities.serviceName) missingFields.push('serviceName')
    if (!entities.amount && !entities.recurrence) missingFields.push('amount_or_recurrence')
  }
  if (action === Action.UPDATE || action === Action.DELETE) {
    if (!entities.serviceName && !entities.actionText) missingFields.push('target')
  }

  return {
    canExecute: missingFields.length === 0,
    missingFields,
    reasons
  }
}

module.exports = { plan }
