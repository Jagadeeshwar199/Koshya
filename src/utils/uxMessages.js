const HELP_TEXT = `👋 Hey! I'm Koshya.

Just message me naturally:

📅 Reminders
"Remind me to pay rent tomorrow at 9 PM"

💳 Subscriptions
"Netflix renews on the 27th every month"

✏️ Updates
"Sorry, make it 8 PM"

That's it. No commands to learn.`

const WELCOME_TEXT = `👋 Welcome to Koshya

I can find subscriptions from your bank statement.

📄 Upload a bank statement (PDF/CSV) to get started.`

const SUB_SAVED_NEXT = ''
const REM_SAVED_NEXT = ''

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

function ambiguousShortReply(serviceName) {
  const name = serviceName || 'that'
  return `What should I do with ${name} tomorrow?\n\nExamples:\n• ${name} expires tomorrow\n• Remind me about ${name} tomorrow at 8 PM`
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
    return `What should I delete?\n\nReply:\nDelete something`
  }
  return `I'm not sure what you mean.\n\nTry:\nShow subscriptions\nRemind me tomorrow at 8 PM\n\nReply help for more.`
}

module.exports = {
  HELP_TEXT,
  WELCOME_TEXT,
  SUB_SAVED_NEXT,
  REM_SAVED_NEXT,
  clarifyLowConfidence,
  ambiguousShortReply,
  unknownReply
}
