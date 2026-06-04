const assert = require('node:assert/strict')
const { detectIntent, INTENTS } = require('../src/services/intentService')

const cases = [
  ['Netflix renews on 27th every month - 149', INTENTS.SUBSCRIPTION_CREATE],
  ['Spotify monthly 119', INTENTS.SUBSCRIPTION_CREATE],
  ['Add Netflix subscription', INTENTS.SUBSCRIPTION_CREATE],
  ['Change Netflix amount to 199', INTENTS.SUBSCRIPTION_UPDATE],
  ['Update Spotify renewal date', INTENTS.SUBSCRIPTION_UPDATE],
  ['change to 9 AM', INTENTS.REMINDER_RESCHEDULE],
  ['change to 7 PM', INTENTS.REMINDER_RESCHEDULE],
  ['make it 6 PM', INTENTS.REMINDER_RESCHEDULE],
  ['set reminder to 8 AM', INTENTS.REMINDER_RESCHEDULE],
  ['move reminder to tomorrow evening', INTENTS.REMINDER_RESCHEDULE],
  ['move it to Monday', INTENTS.REMINDER_RESCHEDULE],
  ['move reminder to next week', INTENTS.REMINDER_RESCHEDULE],
  ['reschedule to tomorrow morning', INTENTS.REMINDER_RESCHEDULE],
  ['move it to June 10', INTENTS.REMINDER_RESCHEDULE],
  ['move to Monday', INTENTS.REMINDER_RESCHEDULE],
  ['change reminder time', INTENTS.REMINDER_RESCHEDULE],
  ['cancel reminder', INTENTS.REMINDER_CANCEL],
  ['cancel exercise reminder', INTENTS.REMINDER_CANCEL],
  ['delete my exercise reminder', INTENTS.REMINDER_CANCEL],
  ['remove reminder', INTENTS.REMINDER_CANCEL],
  ['stop reminding me about exercise', INTENTS.REMINDER_CANCEL],
  ['remove Netflix', INTENTS.SUBSCRIPTION_DELETE],
  ['delete sleep', INTENTS.DELETE_ENTITY],
  ['Delete Spotify', INTENTS.DELETE_ENTITY],
  ['delete Netflix subscription', INTENTS.SUBSCRIPTION_DELETE],
  ['cancel Netflix subscription', INTENTS.SUBSCRIPTION_DELETE],
  ['stop tracking Netflix', INTENTS.SUBSCRIPTION_DELETE],
  ['Show my subscriptions', INTENTS.SUBSCRIPTION_QUERY],
  ['List subscriptions', INTENTS.SUBSCRIPTION_QUERY],
  ['Tell me about Netflix subscription', INTENTS.SUBSCRIPTION_QUERY],
  ['Remind me tomorrow about Netflix', INTENTS.REMINDER_CREATE],
  ['Create a reminder for rent on June 5', INTENTS.REMINDER_CREATE],
  ['Remind me to pay electricity bill', INTENTS.REMINDER_CREATE],
  [
    'Remind me to update the warranty for the fans in the evening',
    INTENTS.REMINDER_CREATE
  ],
  ['Remind me to update warranty for fans at 7 pm', INTENTS.REMINDER_CREATE],
  ['Show today reminders', INTENTS.REMINDER_QUERY],
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
  ['Tomorrow subscriptions', INTENTS.SUBSCRIPTION_QUERY],
  ['How many subscriptions do I have?', INTENTS.SUBSCRIPTION_QUERY],
  ['What renews next?', INTENTS.SUBSCRIPTION_QUERY],
  ['What renews this month?', INTENTS.SUBSCRIPTION_QUERY],
  ['Update Netflix to 199', INTENTS.SUBSCRIPTION_UPDATE],
  ['Show Netflix reminder', INTENTS.REMINDER_QUERY],
  ['Tell me about an existing Netflix reminder', INTENTS.REMINDER_QUERY],
  ['What renews tomorrow?', INTENTS.SUBSCRIPTION_QUERY],
  ['What is due tomorrow', INTENTS.REMINDER_QUERY],
  ['Netflix renewal tomorrow', INTENTS.SUBSCRIPTION_QUERY],
  ['Help', INTENTS.HELP],
  ['start', INTENTS.HELP],
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

assert.equal(detectIntent('7 pm').intent, INTENTS.UNKNOWN)
assert.equal(detectIntent('Okay').intent, INTENTS.CONFIRM)

assert.equal(detectIntent('Delete everything').intent, INTENTS.UNKNOWN)

console.log('Intent tests passed:', cases.length + 5)
