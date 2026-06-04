/** Domain + Action model (shadow pipeline). Extend enums for new product areas. */

export enum Domain {
  REMINDER = 'REMINDER',
  SUBSCRIPTION = 'SUBSCRIPTION',
  GENERAL = 'GENERAL',
  UNKNOWN = 'UNKNOWN'
}

export enum Action {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LIST = 'LIST',
  QUERY = 'QUERY',
  HELP = 'HELP',
  UNKNOWN = 'UNKNOWN'
}

export interface DetectionResult {
  domain: Domain
  action: Action
  score: number
  entities: Record<string, unknown>
  reasons: string[]
  canExecute: boolean
  missingFields: string[]
  usedAI: boolean
}
