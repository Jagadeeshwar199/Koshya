const HELP_TEXT = `👋 Koshya tracks subscriptions & reminders.

Subscriptions:
Netflix renews on 27th every month - 149
Show subscriptions
Delete Netflix

Reminders:
Remind me to pay rent tomorrow at 9 PM
Show reminders
Delete rent reminder

Reply help anytime.`

const WELCOME_TEXT = `👋 Hey! I'm Koshya.

I can help you keep track of subscriptions and reminders.

Try sending:

Netflix renews on 27th every month - 149

or

Remind me to pay rent tomorrow at 8 PM

Type help if you get stuck.`

const SUB_SAVED_NEXT = '\n\nNext:\n• Show subscriptions\n• What renews next?'
const REM_SAVED_NEXT = '\n\nNext:\n• Change to 7 PM\n• Show reminders'

function clarifyLowConfidence(intent) {
  const map = {
    SUBSCRIPTION_CREATE: 'Add a subscription like:\nNetflix renews on 27th every month - 149',
    SUBSCRIPTION_DELETE: 'Which one?\nTry: Delete Netflix',
    SUBSCRIPTION_UPDATE: 'Which subscription and new amount?\nTry: Update Netflix to 199',
    REMINDER_CREATE: 'When should I remind you?\nTry: tomorrow at 8 PM',
    REMINDER_RESCHEDULE: 'Which reminder and new time?\nTry: Change reminder to 7 PM',
    REMINDER_CANCEL: 'Which reminder?\nTry: Delete rent reminder',
    REMINDER_QUERY: 'Try:\nShow reminders\nShow today reminders'
  }
  return map[intent] || null
}

function unknownReply(text) {
  const lower = String(text || '').toLowerCase()
  if (/\b(remind|forget|later)\b/.test(lower)) {
    return `Sounds like a reminder.\n\nTry:\nRemind me to pay rent tomorrow at 9 PM`
  }
  if (/\b(netflix|spotify|subscription|renew|monthly)\b/.test(lower)) {
    return `Sounds like a subscription.\n\nTry:\nNetflix renews on 27th every month - 149`
  }
  if (/^(delete|remove|cancel)$/i.test(text)) {
    return `What should I remove?\n\nTry:\nDelete Netflix\nDelete rent reminder`
  }
  return `I'm not sure what you mean.\n\nTry:\nShow subscriptions\nRemind me tomorrow at 8 PM\n\nReply help for more.`
}

module.exports = {
  HELP_TEXT,
  WELCOME_TEXT,
  SUB_SAVED_NEXT,
  REM_SAVED_NEXT,
  clarifyLowConfidence,
  unknownReply
}
