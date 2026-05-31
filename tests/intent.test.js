const assert = require('node:assert/strict')
const { detectIntent, INTENTS } = require('../src/services/intentService')

const cases = [
  ['Netflix renews on 27th every month - 149', INTENTS.SUBSCRIPTION_CREATE],
  ['Spotify monthly 119', INTENTS.SUBSCRIPTION_CREATE],
  ['Add Netflix subscription', INTENTS.SUBSCRIPTION_CREATE],
  ['Change Netflix amount to 199', INTENTS.SUBSCRIPTION_UPDATE],
  ['Update Spotify renewal date', INTENTS.SUBSCRIPTION_UPDATE],
  ['Show my subscriptions', INTENTS.SUBSCRIPTION_QUERY],
  ['List subscriptions', INTENTS.SUBSCRIPTION_QUERY],
  ['Tell me about Netflix subscription', INTENTS.SUBSCRIPTION_QUERY],
  ['Remind me tomorrow about Netflix', INTENTS.REMINDER_CREATE],
  ['Create a reminder for rent on June 5', INTENTS.REMINDER_CREATE],
  ['Remind me to pay electricity bill', INTENTS.REMINDER_CREATE],
  ['What reminders do I have?', INTENTS.REMINDER_QUERY],
  ["Tomorrow's reminders", INTENTS.REMINDER_QUERY],
  ['Tomorrows reminders', INTENTS.REMINDER_QUERY],
  ['Reminders tomorrow', INTENTS.REMINDER_QUERY],
  ['My reminders tomorrow', INTENTS.REMINDER_QUERY],
  ['Show reminders tomorrow', INTENTS.REMINDER_QUERY],
  ['Tomorrow reminders', INTENTS.REMINDER_QUERY],
  ['Upcoming reminders', INTENTS.REMINDER_QUERY],
  ['Upcoming reminders tomorrow', INTENTS.REMINDER_QUERY],
  ['Tomorrow renewal reminders', INTENTS.REMINDER_QUERY],
  ['Tomorrow subscriptions', INTENTS.REMINDER_QUERY],
  ['Show Netflix reminder', INTENTS.REMINDER_QUERY],
  ['Tell me about an existing Netflix reminder', INTENTS.REMINDER_QUERY],
  ['What renews tomorrow?', INTENTS.REMINDER_QUERY],
  ['What is due tomorrow', INTENTS.REMINDER_QUERY],
  ['Netflix renewal tomorrow', INTENTS.REMINDER_QUERY],
  ['Help', INTENTS.HELP],
  ['What can you do?', INTENTS.HELP],
  ['random unrelated words', INTENTS.UNKNOWN]
]

for (const [message, expected] of cases) {
  const result = detectIntent(message)
  assert.equal(result.intent, expected, `${message} should be ${expected}`)
  assert.ok(result.confidence >= 0, `${message} should include confidence`)
  assert.equal(typeof result.entities, 'object')
}

const netflixReminder = detectIntent('Tell me about an existing Netflix reminder')
assert.equal(netflixReminder.entities.serviceName, 'Netflix')

const update = detectIntent('Change Netflix amount to 199')
assert.equal(update.entities.serviceName, 'Netflix')
assert.equal(update.entities.amount, 199)

console.log('Intent tests passed:', cases.length + 2)
