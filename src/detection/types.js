/** Runtime mirror of types.ts — keep in sync when adding domains/actions. */

const Domain = {
  REMINDER: 'REMINDER',
  SUBSCRIPTION: 'SUBSCRIPTION',
  GENERAL: 'GENERAL',
  UNKNOWN: 'UNKNOWN'
}

const Action = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LIST: 'LIST',
  QUERY: 'QUERY',
  HELP: 'HELP',
  UNKNOWN: 'UNKNOWN'
}

const Decision = {
  EXECUTE: 'EXECUTE',
  CLARIFY: 'CLARIFY',
  AI_FALLBACK: 'AI_FALLBACK',
  REJECTED_LOW_SCORE: 'REJECTED_LOW_SCORE'
}

module.exports = { Domain, Action, Decision }
