/** [category, expect, message, req?] expect: reminder|subscription_renewal|subscription_expiry|multi req: {d,s,r,q,multi:[]} */
const c = (cat, exp, msg, req) => [cat, exp, msg, req || {}]

module.exports = [
  ...[
    ['Reminder', 'reminder', 'Remind me to drink water at 7 PM'],
    ['Reminder', 'reminder', 'Remind me to call mom tomorrow'],
    ['Reminder', 'reminder', 'Notify me at 6 PM'],
    ['Reminder', 'reminder', 'Ping me in 20 minutes'],
    ['Reminder', 'reminder', 'Alarm for 5 AM'],
    ['Reminder', 'reminder', 'Wake me tomorrow at 5'],
    ['Reminder (no keyword)', 'reminder', 'Need to call mom tomorrow'],
    ['Reminder (no keyword)', 'reminder', 'Must pay rent on 1st'],
    ['Reminder (no keyword)', 'reminder', 'Doctor appointment Friday'],
    ['Reminder (no keyword)', 'reminder', 'Meeting at 4 PM'],
    ['Reminder (no keyword)', 'reminder', 'Gym tomorrow morning'],
    ['Reminder (no keyword)', 'reminder', 'Buy milk tonight'],
    ['Reminder (no keyword)', 'reminder', 'Passport renewal next week'],
    ['Short', 'reminder', 'Mom tomorrow'],
    ['Short', 'reminder', 'Rent 1st'],
    ['Short', 'reminder', 'Milk tonight'],
    ['Short', 'reminder', 'Gym 6 AM'],
    ['Short', 'reminder', 'Doctor Friday'],
    ['Short', 'reminder', 'EMI 5th']
  ].map(([a, b, m]) => c(a, b, m, { d: 1 })),
  ...[
    ['Subscription Renewal', 'subscription_renewal', 'Netflix renews on 27th every month'],
    ['Subscription Renewal', 'subscription_renewal', 'Prime renews on 23rd monthly'],
    ['Subscription Renewal', 'subscription_renewal', 'Spotify yearly on June 10'],
    ['Subscription Renewal', 'subscription_renewal', 'ChatGPT Plus renews next month'],
    ['Subscription Renewal', 'subscription_renewal', 'Cursor renews every year']
  ].map(([a, b, m]) => c(a, b, m, { s: 1 })),
  ...[
    ['Subscription Expiry', 'subscription_expiry', 'Netflix expires tomorrow'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix ends tomorrow'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix ending tomorrow'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix finishes tomorrow'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix runs out tomorrow'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix valid till Friday'],
    ['Subscription Expiry', 'subscription_expiry', 'Netflix active till Friday'],
    ['Subscription Expiry', 'subscription_expiry', 'Prime expires next week'],
    ['Subscription Expiry', 'subscription_expiry', 'Spotify expires tonight'],
    ['Subscription Expiry', 'subscription_expiry', 'Cursor plan ends tomorrow']
  ].map(([a, b, m]) => c(a, b, m, { d: 1, s: 1, q: 'expiry' })),
  c('Time Included', 'subscription_expiry', 'Netflix ends at 7 PM tomorrow', { d: 1, s: 1, q: 'expiry' }),
  c('Time Included', 'subscription_expiry', 'Prime expires at midnight', { d: 1 }),
  c('Time Included', 'subscription_expiry', 'Spotify stops at 9 PM Sunday', { d: 1, s: 1 }),
  c('Time Included', 'subscription_expiry', 'ChatGPT valid till 11:59 PM today', { d: 1, s: 1 }),
  ...[
    ['Payments', 'subscription_renewal', 'Netflix charges me on 27th'],
    ['Payments', 'subscription_renewal', 'Prime bill comes every month'],
    ['Payments', 'subscription_renewal', 'Spotify payment due on 10th'],
    ['Payments', 'subscription_renewal', 'ChatGPT gets deducted yearly'],
    ['Payments', 'subscription_renewal', 'Cursor payment every 12 months']
  ].map(([a, b, m]) => c(a, b, m, { s: 1 })),
  ...[
    ['Natural Language', 'subscription_expiry', 'My Netflix time is over tomorrow'],
    ['Natural Language', 'subscription_expiry', "Prime won't work after Sunday"],
    ['Natural Language', 'subscription_expiry', 'Spotify will stop next week'],
    ['Natural Language', 'subscription_expiry', 'ChatGPT premium finishes this month'],
    ['Natural Language', 'subscription_expiry', 'Cursor is active only till Friday']
  ].map(([a, b, m]) => c(a, b, m, { d: 1, s: 1, q: 'expiry' })),
  ...[
    ['Spelling', 'reminder', 'remindar me tomorrow', { d: 1 }],
    ['Spelling', 'reminder', 'remnder call mom', {}],
    ['Spelling', 'reminder', 'remeber rent 1st', { d: 1 }],
    ['Spelling', 'reminder', 'alrm 5 am', { d: 1 }],
    ['Spelling', 'reminder', 'notifiy me tonight', { d: 1 }],
    ['Spelling', 'subscription_expiry', 'netflx expire tomoro', { d: 1, s: 1, q: 'expiry' }],
    ['Spelling', 'subscription_renewal', 'spoitfy renewl next month', { s: 1 }],
    ['Spelling', 'subscription_expiry', 'subscrption ends friday', { d: 1, q: 'expiry' }],
    ['Spelling', 'subscription_expiry', 'suscription expire next week', { d: 1, q: 'expiry' }],
    ['Spelling', 'subscription_expiry', 'expries tomorrow', { d: 1 }]
  ].map((x) => c(...x)),
  ...[
    ['Relative Time', 'reminder', 'in 5 mins remind me', { d: 1 }],
    ['Relative Time', 'reminder', 'after 20 minutes drink water', { d: 1 }],
    ['Relative Time', 'reminder', 'after an hour call mom', { d: 1 }],
    ['Relative Time', 'reminder', '2 hours later check mail', { d: 1 }],
    ['Relative Time', 'reminder', 'tomorrow morning gym', { d: 1 }],
    ['Relative Time', 'reminder', 'day after tomorrow doctor', { d: 1 }]
  ].map((x) => c(...x)),
  ...[
    ['Recurring', 'reminder', 'every day drink water at 8', { d: 1, r: 1 }],
    ['Recurring', 'reminder', 'daily exercise at 7', { d: 1, r: 1 }],
    ['Recurring', 'reminder', 'every weekday standup at 10', { d: 1, r: 1 }],
    ['Recurring', 'reminder', 'every monday team sync', { d: 1, r: 1 }],
    ['Recurring', 'reminder', 'monthly rent payment', { r: 1 }],
    ['Recurring', 'subscription_renewal', 'yearly insurance renewal', { r: 1 }]
  ].map((x) => c(...x)),
  ...[
    ['Recurring Subscription', 'subscription_renewal', 'Netflix every month on 27th'],
    ['Recurring Subscription', 'subscription_renewal', 'Prime monthly on 23rd'],
    ['Recurring Subscription', 'subscription_renewal', 'Spotify yearly June 10'],
    ['Recurring Subscription', 'subscription_renewal', 'ChatGPT renews annually'],
    ['Recurring Subscription', 'subscription_renewal', 'Cursor renewal every year']
  ].map(([a, b, m]) => c(a, b, m, { s: 1, r: 1 })),
  ...[
    ['Unknown Services', 'subscription_expiry', 'SuperStream expires tomorrow', { d: 1, s: 1 }],
    ['Unknown Services', 'subscription_renewal', 'ABC Premium renews monthly', { s: 1, r: 1 }],
    ['Unknown Services', 'subscription_expiry', 'XYZ App ends Friday', { d: 1, s: 1 }],
    ['Unknown Services', 'subscription_renewal', 'DevTool Pro renews next year', { s: 1 }]
  ].map((x) => c(...x)),
  c('Mixed', 'multi', 'Netflix expires tomorrow remind me today', { multi: ['subscription_expiry', 'reminder'] }),
  c('Mixed', 'multi', 'Prime renews next week remind me one day before', { multi: ['subscription_renewal', 'reminder'] }),
  c('Mixed', 'multi', 'Spotify ends Friday notify me Thursday', { multi: ['subscription_expiry', 'reminder'] }),
  ...[
    ['WhatsApp Style', 'ambiguous', 'netflix tmrw', { d: 1, s: 1 }],
    ['WhatsApp Style', 'subscription_expiry', 'prime nxt wk', { d: 1 }],
    ['WhatsApp Style', 'reminder', 'mom call tmrw', { d: 1 }],
    ['WhatsApp Style', 'reminder', 'rent due 1st', { d: 1 }],
    ['WhatsApp Style', 'reminder', 'gym 6am', { d: 1 }],
    ['WhatsApp Style', 'reminder', 'water 8pm daily', { d: 1, r: 1 }],
    ['WhatsApp Style', 'subscription_renewal', 'spotify renewl 10 jun', { s: 1 }]
  ].map((x) => c(...x)),
  ...[
    ['Garbage', 'reminder', 'rmndr mom tmrw', { d: 1 }],
    ['Garbage', 'subscription_expiry', 'ntflx exprs tmrw', { d: 1 }],
    ['Garbage', 'subscription_renewal', 'sprtfy rnwl nxt mnth', { s: 1 }],
    ['Garbage', 'reminder', 'alrm 6', { d: 1 }],
    ['Garbage', 'reminder', 'pay emi 5', { d: 1 }]
  ].map((x) => c(...x)),
  c('Multi Intent', 'multi', 'Netflix expires tomorrow and remind me today at 8 PM', {
    multi: ['subscription_expiry', 'reminder'], d: 1
  }),
  c('Multi Intent', 'multi', 'Pay rent on 1st and renew Prime on 23rd', {
    multi: ['reminder', 'subscription_renewal'], d: 1
  }),
  c('Multi Intent', 'multi', 'Doctor appointment Friday and Spotify expires Sunday', {
    multi: ['reminder', 'subscription_expiry'], d: 1
  }),
  c('Ultimate', 'multi', 'my netflx premium ends tmrw 7pm remindar me today evening and it renews every month on 27th', {
    multi: ['subscription_expiry', 'subscription_renewal', 'reminder'], d: 1, s: 1
  })
]
