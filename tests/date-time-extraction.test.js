#!/usr/bin/env node
const assert = require('node:assert/strict')

const { extractDate } = require('../src/intent/entityExtractor')

const ordinals = [
  '10th June',
  '11th June',
  '12th June',
  '13th June',
  '21st June',
  '22nd June',
  '23rd June',
  '24th June',
  '31st June',
  '44th June',
  '55th June',
  '66th June'
]

for (const text of ordinals) {
  const date = extractDate(`on ${text}`)
  assert.equal(date?.kind, 'month_day', text)
  assert.equal(date?.time, undefined, `no time from: ${text}`)
}

const fibernet = extractDate('ACT fibernet renews at 10th june every 3 months')
assert.equal(fibernet?.kind, 'month_day')
assert.equal(fibernet?.time, undefined)

assert.equal(extractDate('at 10')?.time?.hour, 10)
assert.equal(extractDate('at 10 am')?.time?.hour, 10)
assert.equal(extractDate('at 11 pm')?.time?.hour, 23)
assert.equal(extractDate('tomorrow at 8')?.time?.hour, 8)
assert.equal(extractDate('every day at 7 am')?.time?.hour, 7)

console.log('Date/time extraction tests passed:', ordinals.length + 6)
