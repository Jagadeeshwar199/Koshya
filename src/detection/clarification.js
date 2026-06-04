/** Targeted clarification copy — EXTENSION: per-domain question templates. */
const { Domain, Action } = require('./types')

function buildClarification(domain, action, entities, missingFields) {
  const name = entities.serviceName || entities.actionText || ''
  if (missingFields.includes('date') && domain === Domain.SUBSCRIPTION && name) {
    return `When does ${name} renew?`
  }
  if (missingFields.includes('date') && domain === Domain.REMINDER) {
    if (/rent|emi|pay/i.test(String(name))) return 'When should I remind you?'
    return 'When should I remind you?'
  }
  if (missingFields.includes('serviceName') && domain === Domain.SUBSCRIPTION) {
    return 'Which subscription is this for?'
  }
  if (missingFields.includes('subject') && domain === Domain.REMINDER) {
    return 'What should I remind you about?'
  }
  if (missingFields.includes('target')) {
    return domain === Domain.SUBSCRIPTION
      ? 'Which subscription should I update or remove?'
      : 'Which reminder should I change or cancel?'
  }
  if (missingFields.includes('amount_or_recurrence')) {
    return 'What is the amount or billing cycle (e.g. monthly)?'
  }
  if (action === Action.UNKNOWN) return 'What would you like me to do — remind, track a subscription, or list something?'
  return 'Can you share a bit more detail so I can help?'
}

module.exports = { buildClarification }
