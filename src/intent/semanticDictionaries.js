const REMINDER_TERMS = [
  'remind', 'reminder', 'remindar', 'remnder', 'remember', 'dont forget',
  'do not forget', 'ping', 'notify', 'alert', 'alarm', 'wake', 'wake me',
  'note', 'followup', 'follow up', 'monitor', 'later'
]

const SUBSCRIPTION_TERMS = [
  'subscription', 'subscripton', 'subcription', 'suscription', 'sub',
  'premium', 'membership', 'plan', 'package', 'renewal', 'renew', 'billing', 'bill'
]

const EXPIRY_TERMS = [
  'expire', 'expires', 'expired', 'expiry', 'end', 'ends', 'ending',
  'finish', 'finishes', 'finishing', 'runs out', 'valid till', 'active till',
  'stops', 'time is over', 'runs out', 'stop working', 'valid only till'
]

const PAYMENT_TERMS = [
  'pay', 'payment', 'paid', 'charge', 'charged', 'billing', 'invoice', 'due', 'debit'
]

const ACTION_VERBS = [
  'need', 'must', 'should', 'have to', 'call', 'pay', 'buy', 'get', 'visit',
  'book', 'submit', 'send', 'finish', 'complete', 'check', 'pick', 'order',
  'renew', 'update', 'fix', 'clean', 'take', 'go', 'meet', 'attend'
]

const QUERY_TERMS = ['show', 'list', 'what', 'which', 'tell me', 'how many', 'my']
const DELETE_TERMS = ['delete', 'remove', 'cancel', 'stop']
const UPDATE_TERMS = ['change', 'update', 'edit', 'modify', 'move', 'reschedule', 'make', 'set']

const DEFAULT_FUZZY_THRESHOLD = Number(process.env.INTENT_FUZZY_THRESHOLD || 0.34)

module.exports = {
  REMINDER_TERMS,
  SUBSCRIPTION_TERMS,
  EXPIRY_TERMS,
  PAYMENT_TERMS,
  ACTION_VERBS,
  QUERY_TERMS,
  DELETE_TERMS,
  UPDATE_TERMS,
  DEFAULT_FUZZY_THRESHOLD
}
