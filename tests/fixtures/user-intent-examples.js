const { INTENTS } = require('../../src/services/intentService')

/** @typedef {{ queryType?: string, serviceName?: string, hasDate?: boolean, hasRecurrence?: boolean, hasAmount?: boolean, actionContains?: string, entityType?: 'reminder'|'subscription' }} Expect */

/** @param {string} message @param {string} intent @param {Expect} [expect] */
function c(message, intent, expect = {}) {
  return { message, intent, expect }
}

const reminders = [
  c('Remind me to drink water at 7 PM', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('remindar me drink water 7 pm', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('remnder water 7', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Ping me at 6', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Notify me tomorrow morning', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Alarm at 5 AM', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Wake me at 5', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Wake me tomorrow at 5', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c("Don't let me forget to pay rent", INTENTS.REMINDER_CREATE),
  c('Need to call mom tomorrow', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Must pay electricity bill on 10th', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Doctor appointment Friday', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Meeting at 4 PM', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Gym tomorrow morning', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Buy milk tonight', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Need passport renewal next week', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Follow up with client Monday', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Check bank statement tomorrow', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Pay EMI on 5th', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Call dentist after lunch', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Remind me after 20 mins', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('in 20 mins remind me', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('20 mins later remind me', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('after an hour remind me', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('after 2 hrs call mom', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('after dinner take medicine', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('before sleeping check email', INTENTS.REMINDER_CREATE, { hasDate: true })
]

const subscriptionCreate = [
  c('Netflix renews on 27th every month', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Netflix', hasRecurrence: true, entityType: 'subscription' }),
  c('Prime renews on 23rd monthly', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Prime', hasRecurrence: true, entityType: 'subscription' }),
  c('Spotify yearly on June 10', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Spotify', hasRecurrence: true, entityType: 'subscription' }),
  c('ChatGPT Plus renews next month', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'ChatGPT', entityType: 'subscription' }),
  c('Renew Cursor yearly', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Cursor', hasRecurrence: true, entityType: 'subscription' })
]

const subscriptionExpiry = [
  c('Netflix expires tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true, entityType: 'subscription' }),
  c('Netflix ends tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Netflix ending tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Netflix finishes tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Netflix runs out tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Netflix valid till Friday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Netflix active till Friday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('My Netflix stops tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('My Netflix ends at 7 PM tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Prime expires next week', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Prime', hasDate: true }),
  c('Spotify expires tonight', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Spotify', hasDate: true }),
  c('ChatGPT ends on June 30', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'ChatGPT', hasDate: true }),
  c('Cursor plan ends tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', hasDate: true }),
  c('Canva premium expires Sunday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Canva', hasDate: true }),
  c('Hotstar ends next month', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Hotstar', hasDate: true }),
  c('JioHotstar valid till 20th', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'JioHotstar', hasDate: true })
]

const spelling = [
  c('netflx expire tomoro', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('netflix expries tommorow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('spoitfy renewl next month', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Spotify', entityType: 'subscription' }),
  c('subscrption ends friday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', hasDate: true }),
  c('suscription expire next week', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', hasDate: true }),
  c('remeber me tomorrow', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('remindar rent payment', INTENTS.REMINDER_CREATE),
  c('alrm 6 am', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('notifiy tomorrow', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('remeind me after lunch', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('subcription renews 23rd', INTENTS.SUBSCRIPTION_CREATE, { hasRecurrence: true, entityType: 'subscription' })
]

const shortMessages = [
  c('Netflix tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('Prime 23rd', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Prime', hasDate: true, entityType: 'subscription' }),
  c('Spotify next week', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Spotify', hasDate: true }),
  c('ChatGPT June 20', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'ChatGPT', hasDate: true }),
  c('Rent 1st', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Milk tonight', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Mom tomorrow', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Doctor Friday', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('Gym 6 AM', INTENTS.REMINDER_CREATE, { hasDate: true }),
  c('EMI 5th', INTENTS.REMINDER_CREATE, { hasDate: true })
]

const naturalLanguage = [
  c('My Netflix time is over tomorrow', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Netflix', hasDate: true }),
  c('My Prime package finishes next week', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Prime', hasDate: true }),
  c('Spotify will stop working on Sunday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'Spotify', hasDate: true }),
  c('ChatGPT premium is valid only till Friday', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', serviceName: 'ChatGPT', hasDate: true }),
  c('My Cursor subscription runs out tonight', INTENTS.SUBSCRIPTION_QUERY, { queryType: 'expiry', hasDate: true }),
  c('I need Netflix again on 27th every month', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Netflix', hasRecurrence: true, entityType: 'subscription' }),
  c('Prime payment gets deducted on the 23rd', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Prime', hasDate: true, entityType: 'subscription' }),
  c('Spotify charges me every month on the 10th', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Spotify', hasRecurrence: true, entityType: 'subscription' }),
  c('ChatGPT bill comes yearly', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'ChatGPT', hasRecurrence: true, entityType: 'subscription' }),
  c('Netflix takes money every month', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Netflix', hasRecurrence: true, entityType: 'subscription' })
]

const recurrence = [
  c('every day drink water at 8', INTENTS.REMINDER_CREATE, { hasDate: true, hasRecurrence: true }),
  c('daily exercise at 7', INTENTS.REMINDER_CREATE, { hasDate: true, hasRecurrence: true }),
  c('every weekday standup at 10', INTENTS.REMINDER_CREATE, { hasDate: true, hasRecurrence: true }),
  c('every monday team sync', INTENTS.REMINDER_CREATE, { hasDate: true, hasRecurrence: true }),
  c('monthly rent payment', INTENTS.REMINDER_CREATE, { hasRecurrence: true }),
  c('yearly insurance renewal', INTENTS.SUBSCRIPTION_CREATE, { hasRecurrence: true, entityType: 'subscription' }),
  c('every 23rd renew Prime', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Prime', hasRecurrence: true, entityType: 'subscription' }),
  c('every June 10 Spotify renewal', INTENTS.SUBSCRIPTION_CREATE, { serviceName: 'Spotify', hasRecurrence: true, entityType: 'subscription' })
]

module.exports = {
  all: () => [
    ...reminders,
    ...subscriptionCreate,
    ...subscriptionExpiry,
    ...spelling,
    ...shortMessages,
    ...naturalLanguage,
    ...recurrence
  ]
}
