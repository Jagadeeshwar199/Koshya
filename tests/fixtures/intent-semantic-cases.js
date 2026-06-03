const { INTENTS } = require('../../src/services/intentService')

const legacy = [
  ['Netflix renews on 27th every month - 149', INTENTS.SUBSCRIPTION_CREATE],
  ['Spotify monthly 119', INTENTS.SUBSCRIPTION_CREATE],
  ['Add Netflix subscription', INTENTS.SUBSCRIPTION_CREATE],
  ['Change Netflix amount to 199', INTENTS.SUBSCRIPTION_UPDATE],
  ['change to 9 AM', INTENTS.REMINDER_RESCHEDULE],
  ['cancel reminder', INTENTS.REMINDER_CANCEL],
  ['delete sleep', INTENTS.DELETE_ENTITY],
  ['remove Netflix', INTENTS.SUBSCRIPTION_DELETE],
  ['Show today reminders', INTENTS.REMINDER_QUERY],
  ['Help', INTENTS.HELP]
]

const expiry = [
  ['Netflix ends tomorrow', INTENTS.SUBSCRIPTION_EXPIRY],
  ['Prime expires next week', INTENTS.SUBSCRIPTION_EXPIRY],
  ['Spotify runs out tonight', INTENTS.SUBSCRIPTION_EXPIRY],
  ['ChatGPT valid till June 20', INTENTS.SUBSCRIPTION_EXPIRY],
  ['My Netflix ends at 7 PM tomorrow', INTENTS.SUBSCRIPTION_EXPIRY]
]

const implicitReminders = [
  ['Need to call mom tomorrow', INTENTS.REMINDER_CREATE],
  ['Must pay rent on 1st', INTENTS.REMINDER_CREATE],
  ['Doctor appointment Friday', INTENTS.REMINDER_CREATE],
  ['Buy milk tonight', INTENTS.REMINDER_CREATE]
]

const typos = [
  ['remindar me to pay rent tomorrow', INTENTS.REMINDER_CREATE],
  ['remnder me about gym at 7pm', INTENTS.REMINDER_CREATE],
  ['dont forget water in 10 minutes', INTENTS.REMINDER_CREATE],
  ['ping me about meeting tomorrow', INTENTS.REMINDER_CREATE],
  ['notify me to submit report friday', INTENTS.REMINDER_CREATE],
  ['subscripton for netflix monthly 149', INTENTS.SUBSCRIPTION_CREATE],
  ['suscription spotify yearly', INTENTS.SUBSCRIPTION_CREATE]
]

const slang = [
  ['yo remind me to call raj tomorrow', INTENTS.REMINDER_CREATE],
  ['pls track prime renewal', INTENTS.SUBSCRIPTION_CREATE],
  ['gotta pay wifi on 5th', INTENTS.REMINDER_CREATE]
]

function expandVariants() {
  const generated = []
  const bases = [
    ['remind me to drink water', INTENTS.REMINDER_CREATE],
    ['show reminders', INTENTS.REMINDER_QUERY],
    ['delete netflix', INTENTS.DELETE_ENTITY],
  ['delete netfl!x', INTENTS.DELETE_ENTITY],
    ['netflix renews on 27th every month - 149', INTENTS.SUBSCRIPTION_CREATE]
  ]
  const typoMap = { i: ['1', '!'], e: ['3'], a: ['@'], o: ['0'] }

  for (const [phrase, intent] of bases) {
    generated.push([phrase, intent])
    for (const [from, toList] of Object.entries(typoMap)) {
      if (!phrase.includes(from)) {
        continue
      }
      for (const to of toList) {
        generated.push([phrase.replace(from, to), intent])
      }
    }
  }

  const services = ['netflix', 'spotify', 'prime', 'chatgpt', 'hotstar', 'jio', 'airtel']
  const times = ['tomorrow', 'today', 'tonight', 'next week', 'friday', 'on 1st']
  const expiryVerbs = ['ends', 'expires', 'runs out', 'valid till']

  for (const service of services) {
    for (const time of times) {
      generated.push([`${service} ${expiryVerbs[0]} ${time}`, INTENTS.SUBSCRIPTION_EXPIRY])
      generated.push([`must pay ${service} bill ${time}`, INTENTS.REMINDER_CREATE])
    }
  }

  const reminders = ['call mom', 'pay rent', 'doctor visit', 'buy milk', 'submit form']
  for (const action of reminders) {
    for (const time of times.slice(0, 4)) {
      generated.push([`need to ${action} ${time}`, INTENTS.REMINDER_CREATE])
      generated.push([`must ${action} ${time}`, INTENTS.REMINDER_CREATE])
    }
  }

  const fillers = []
  const offsets = ['in 5 minutes', 'after 10 mins', 'in 1 hour', 'after 2 hours']
  const tasks = ['drink water', 'call mom', 'pay rent', 'walk dog', 'take medicine']
  for (const task of tasks) {
    for (const offset of offsets) {
      fillers.push([`${task} ${offset}`, INTENTS.REMINDER_CREATE])
      fillers.push([`remind me to ${task} ${offset}`, INTENTS.REMINDER_CREATE])
    }
  }

  return [...generated, ...fillers]
}

module.exports = {
  all: () => [
    ...legacy,
    ...expiry,
    ...implicitReminders,
    ...typos,
    ...slang,
    ...expandVariants()
  ]
}
