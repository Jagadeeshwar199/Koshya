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

module.exports = { Domain, Action }
