const assert = require('node:assert/strict')
const parseMessage = require('../services/parserService')

const shouldSave = [
  'Netflix renews on 27th every month - 149',
  'JioHotstar renews on Apr 12 every 3 months - 599',
  'Netflix 149 monthly',
  'Spotify ₹119 monthly'
]

const shouldAsk = [
  'Spotify ₹119',
  'Netflix : 149',
  'Netflix',
  '149',
  'monthly',
  'Need reminder for Netflix',
  'Add Netflix'
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

const followUp = parseMessage('149 monthly', {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
})
assert.equal(followUp.type, 'subscription', 'follow-up should complete')

console.log('Parser tests passed:', shouldSave.length + shouldAsk.length + 1)
