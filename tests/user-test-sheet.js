const { parseMessage } = require('../src/services/parserCore')

const userTests = [
  ['Netflix renews on 27th every month - 149', 'YES'],
  ['Spotify renews on 15th every month - 119', 'YES'],
  ['Prime renews on Jan 20 every year - 1499', 'YES'],
  ['JioHotstar renews on Apr 12 every 3 months - 599', 'NO'],
  ['ChatGPT renews on 5th every month - 1700', 'YES'],
  ['My Netflix subscription is 149 every month on the 27th', 'NO'],
  ['I pay 119 for Spotify every month', 'NO'],
  ['Prime costs 1499 yearly and renews on Jan 20', 'NO'],
  ['JioHotstar renews every 3 months on April 12 for 599', 'NO'],
  ['ChatGPT Plus is 1700 monthly', 'NO'],
  ['Netflix 149 monthly', 'NO'],
  ['Spotify 119 monthly', 'NO'],
  ['Prime 1499 yearly', 'NO'],
  ['ChatGPT 1700 monthly', 'NO'],
  ['YouTube Premium 129 monthly', 'NO'],
  ['Netflix ₹149 monthly', 'NO'],
  ['Spotify ₹119', 'NO'],
  ['Prime yearly ₹1499', 'NO'],
  ['ChatGPT Plus ₹1700 monthly', 'NO'],
  ['Airtel recharge ₹299 every month', 'NO'],
  ['NETFLIX -149 monthly', 'NO'],
  ['Netflix : 149', 'NO'],
  ['Netflix = 149 monthly', 'NO'],
  ['Netflix,149,monthly', 'NO'],
  ['Netflix renews monthly ₹149', 'NO'],
  ['Netflix renews on 31st every month - 149', 'YES'],
  ['Netflix renews Feb 29 every year - 149', 'NO'],
  ['Spotify every 2 months - 119', 'NO'],
  ['Prime every 6 months - 1499', 'NO'],
  ['Adobe yearly - 23999', 'NO'],
  ['Netflix', 'NO'],
  ['149', 'NO'],
  ['monthly', 'NO'],
  ['Need reminder for Netflix', 'NO'],
  ['Netflix subscription', 'NO'],
  ['Add Netflix', 'NO'],
  ['Renewal reminder', 'NO']
]

let improved = 0
let stillBroken = 0

console.log('Message | Yesterday | Now')
console.log('--- | --- | ---')

for (const [msg, yesterday] of userTests) {
  const now = parseMessage(msg).success ? 'YES' : 'NO'
  const fixed = yesterday === 'NO' && now === 'YES'

  if (fixed) {
    improved++
  }

  if (yesterday === 'NO' && now === 'NO' && msg.match(/\d/)) {
    stillBroken++
  }

  const marker = fixed ? ' ✅ fixed' : yesterday !== now ? ' (changed)' : ''
  console.log(`${msg.slice(0, 50)} | ${yesterday} | ${now}${marker}`)
}

console.log(`\nFixed ${improved} messages that failed yesterday`)
console.log(`Still failing (had amount): ${stillBroken}`)
