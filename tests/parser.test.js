const assert = require('node:assert/strict')
const { parseMessage } = require('../services/parserService')

const shouldSave = [
  'Netflix renews on 27th every month - 149',
  'JioHotstar renews on Apr 12 every 3 months - 599',
  'Prime renews on Jan 20 every year - 1499',
  'Prime 1499 yearly'
]

const shouldAsk = [
  'Spotify ₹119',
  'Netflix : 149',
  'Netflix',
  '149',
  'monthly',
  'Need reminder for Netflix',
  'Add Netflix',
  'Netflix 149 monthly',
  'Spotify ₹119 monthly',
  'I pay 119 for Spotify every month',
  'Spotify every 2 months - 119'
]

for (const input of shouldSave) {
  const r = parseMessage(input)
  assert.equal(r.type, 'subscription', `should save: ${input}`)
  assert.equal(r.success, true)
}

for (const input of shouldAsk) {
  const r = parseMessage(input)
  assert.equal(r.type, 'incomplete', `should ask: ${input}`)
  assert.ok(r.missing.length > 0)
}

const followUp = parseMessage('149 monthly on 27th', {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
})
assert.equal(followUp.type, 'subscription', 'follow-up should complete')
assert.equal(followUp.renewalDay, 27)

const netflixPending = {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
}
const switched = parseMessage('prime', netflixPending)
assert.equal(switched.type, 'incomplete', 'service switch should stay incomplete')
assert.equal(switched.draft.serviceName, 'Prime', 'should switch to Prime, not Netflix')

const stillNetflix = parseMessage('149 monthly', netflixPending)
assert.equal(stillNetflix.draft.serviceName, 'Netflix', 'amount follow-up keeps pending service')

console.log(
  'Parser tests passed:',
  shouldSave.length + shouldAsk.length + 1 + 2
)
