const assert = require('node:assert/strict')
const { parseMessage, getMissing } = require('../src/services/parserCore')

function expectAmountAsk(text) {
  const r = parseMessage(text)
  assert.equal(r.type, 'incomplete')
  assert.equal(r.draft.amount, null)
  assert.ok(getMissing(r.draft).includes('amount'))
}

const full199 = parseMessage('Prime 199 monthly on 23rd')
assert.equal(full199.success, true)
assert.equal(full199.amount, 199)
assert.equal(full199.renewalDay, 23)

expectAmountAsk('Prime renews on 23rd every month')
expectAmountAsk('Renew the prime 23 rd june monthly')

const netflix = parseMessage('Netflix 149 monthly on 27th')
assert.equal(netflix.success, true)
assert.equal(netflix.amount, 149)
assert.equal(netflix.renewalDay, 27)

console.log('subscription-amount tests passed')
