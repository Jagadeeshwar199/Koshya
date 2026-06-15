const { INTENTS } = require('../../src/services/intentService')

/** @param {string} message @param {string[]} [alsoAccept] alternate intents */
function m(message, alsoAccept = []) {
  return { message, alsoAccept }
}

const byIntent = {
  [INTENTS.REMINDER_CREATE]: [
    m('remind me tomorrow at 8pm'),
    m('remind me to call mom'),
    m('wake me at 5 AM'),
    m('remind me in 5 mins'),
    m('ping me at 6'),
    m("don't let me forget rent"),
    m('need to call mom tomorrow'),
    m('gym tomorrow morning'),
    m('remind me to drink water at 7 PM'),
    m('meeting at 4 PM')
  ],
  [INTENTS.REMINDER_UPDATE]: [
    m('update my gym reminder', [INTENTS.REMINDER_RESCHEDULE, INTENTS.UNKNOWN]),
    m('rename sleep reminder to nap', [INTENTS.REMINDER_RESCHEDULE, INTENTS.UNKNOWN]),
    m('edit my rent reminder', [INTENTS.REMINDER_RESCHEDULE, INTENTS.REMINDER_QUERY, INTENTS.UNKNOWN]),
    m('modify exercise reminder', [INTENTS.REMINDER_RESCHEDULE, INTENTS.UNKNOWN]),
    m('fix my water reminder', [INTENTS.REMINDER_RESCHEDULE, INTENTS.REMINDER_QUERY, INTENTS.UNKNOWN]),
    m('change reminder about mom', [INTENTS.REMINDER_RESCHEDULE]),
    m('update the gym reminder text', [INTENTS.REMINDER_RESCHEDULE, INTENTS.UNKNOWN]),
    m('change what gym reminder says', [INTENTS.REMINDER_RESCHEDULE, INTENTS.REMINDER_QUERY, INTENTS.UNKNOWN]),
    m('update reminder to pay bills', [INTENTS.REMINDER_RESCHEDULE, INTENTS.REMINDER_CREATE]),
    m('change gym reminder title', [INTENTS.REMINDER_RESCHEDULE, INTENTS.UNKNOWN])
  ],
  [INTENTS.REMINDER_RESCHEDULE]: [
    m('move my gym reminder to 7am', [INTENTS.REMINDER_QUERY]),
    m('change to 9 AM'),
    m('reschedule to tomorrow morning'),
    m('make it 6 PM'),
    m('move reminder to Monday'),
    m('move it to next week'),
    m('set reminder to 8 AM'),
    m('change my toilet reminder to 2 AM'),
    m('shift gym to 7pm', [INTENTS.REMINDER_CREATE]),
    m('postpone to Friday', [INTENTS.REMINDER_CREATE])
  ],
  [INTENTS.REMINDER_CANCEL]: [
    m('cancel exercise reminder'),
    m('delete my gym reminder'),
    m('remove reminder'),
    m('stop reminding me about exercise'),
    m('cancel reminder'),
    m('delete my toilet reminder'),
    m('remove sleep reminder'),
    m('stop my water reminder'),
    m("don't remind me about rent anymore"),
    m('cancel all reminders about gym')
  ],
  [INTENTS.REMINDER_QUERY]: [
    m('show my reminders'),
    m('what reminders do I have?'),
    m('upcoming reminders'),
    m('show reminders tomorrow'),
    m("tomorrow's reminders"),
    m('my reminders tomorrow'),
    m('show today reminders'),
    m('tell me about gym reminder'),
    m('what is due tomorrow'),
    m('list my reminders')
  ],
  [INTENTS.SUBSCRIPTION_CREATE]: [
    m('Netflix renews on 27th every month - 149'),
    m('Spotify monthly 119'),
    m('Prime renews on 23rd monthly'),
    m('Add Netflix subscription'),
    m('Hotstar yearly on Jan 15'),
    m('Netflix every month on 27th'),
    m('Disney+ renews next month'),
    m('YouTube premium renews on 5th every month'),
    m('ChatGPT Plus monthly 20 dollars'),
    m('Apple Music renews yearly')
  ],
  [INTENTS.SUBSCRIPTION_UPDATE]: [
    m('Change Netflix amount to 199'),
    m('Update Spotify renewal date'),
    m('Update Netflix to 199'),
    m('change Netflix expiry to tomorrow 9 PM'),
    m('set Netflix renewal to 28th'),
    m('change prime to 299 per month', [INTENTS.SUBSCRIPTION_CREATE]),
    m('update spotify to yearly', [INTENTS.UNKNOWN]),
    m('edit netflix amount'),
    m('change subscription amount for Netflix'),
    m('move Netflix renewal to 30th', [INTENTS.SUBSCRIPTION_CREATE])
  ],
  [INTENTS.SUBSCRIPTION_DELETE]: [
    m('remove Netflix subscription'),
    m('delete Netflix subscription'),
    m('cancel Netflix subscription'),
    m('stop tracking Netflix'),
    m('remove Spotify'),
    m('delete my Prime subscription'),
    m('cancel Hotstar', [INTENTS.DELETE_ENTITY]),
    m('unsubscribe Netflix'),
    m('remove Disney subscription'),
    m('stop Netflix tracking')
  ],
  [INTENTS.SUBSCRIPTION_QUERY]: [
    m('show my subscriptions'),
    m('list subscriptions'),
    m('what renews tomorrow?'),
    m('how many subscriptions do I have?'),
    m('tell me about Netflix subscription'),
    m('what renews next?'),
    m('what renews this month?'),
    m('show subscriptions'),
    m('Netflix renewal tomorrow'),
    m('what is expiring soon', [INTENTS.SUBSCRIPTION_EXPIRY])
  ],
  [INTENTS.SUBSCRIPTION_EXPIRY]: [
    m('Netflix expires tomorrow'),
    m('Netflix ends tomorrow'),
    m('Prime expires next week'),
    m('Spotify expires tonight'),
    m('when does Netflix expire'),
    m('Netflix runs out tomorrow'),
    m('my Netflix stops tomorrow'),
    m('ChatGPT ends on June 30'),
    m('Hotstar ends next month'),
    m('Canva premium expires Sunday')
  ],
  [INTENTS.DELETE_ENTITY]: [
    m('delete sleep'),
    m('delete netflix'),
    m('delete Spotify'),
    m('remove sleep', [INTENTS.SUBSCRIPTION_DELETE]),
    m('delete gym'),
    m('remove milk reminder', [INTENTS.REMINDER_CANCEL]),
    m('delete prime', [INTENTS.SUBSCRIPTION_DELETE]),
    m('remove rent', [INTENTS.REMINDER_CREATE]),
    m('delete water'),
    m('delete doctor')
  ],
  [INTENTS.HELP]: [
    m('help'),
    m('hi'),
    m('hello'),
    m('start'),
    m('what can you do?'),
    m('how does this work'),
    m('commands'),
    m('good morning'),
    m('hey'),
    m('menu')
  ],
  [INTENTS.LIST_MORE]: [
    m('more'),
    m('show more'),
    m('next'),
    m('show more please', [INTENTS.REMINDER_QUERY]),
    m('more items', [INTENTS.UNKNOWN]),
    m('next page', [INTENTS.SUBSCRIPTION_UPDATE]),
    m('load more', [INTENTS.UNKNOWN]),
    m('see more', [INTENTS.UNKNOWN]),
    m('more subscriptions', [INTENTS.SUBSCRIPTION_UPDATE]),
    m('more reminders', [INTENTS.SUBSCRIPTION_UPDATE])
  ],
  [INTENTS.CONFIRM]: [
    m('yes'),
    m('okay'),
    m('confirm'),
    m('ok'),
    m('sure'),
    m('y'),
    m('k'),
    m('yes please', [INTENTS.SUBSCRIPTION_UPDATE]),
    m('yeah'),
    m('alright')
  ],
  [INTENTS.CANCEL]: [
    m('no'),
    m('cancel'),
    m('stop'),
    m('no thanks'),
    m("don't"),
    m('nevermind'),
    m('nope'),
    m('abort'),
    m('not now'),
    m('leave it', [INTENTS.REMINDER_RESCHEDULE])
  ],
  [INTENTS.UNKNOWN]: [
    m('random unrelated words'),
    m('asdfghjkl'),
    m('???'),
    m('netflix tmrw', [INTENTS.SUBSCRIPTION_EXPIRY, INTENTS.SUBSCRIPTION_CREATE]),
    m('7 pm'),
    m('hmm'),
    m('lol'),
    m('maybe later'),
    m('idk'),
    m('gibberish text here', [INTENTS.SUBSCRIPTION_UPDATE])
  ]
}

function all() {
  const out = []
  for (const [intent, cases] of Object.entries(byIntent)) {
    for (const c of cases) {
      out.push({
        message: c.message,
        intent,
        accept: [intent, ...(c.alsoAccept || [])],
        category: intent
      })
    }
  }
  return out
}

function count() {
  return all().length
}

module.exports = { byIntent, all, count }
