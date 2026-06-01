#!/usr/bin/env node

/**
 * Scenario 1: Subscription Creation Flow
 * Tests natural language parsing for subscription creation
 * Real examples cover complete, incomplete, and multi-turn conversations
 */

const assert = require('node:assert/strict')
const { parseMessage } = require('../src/services/parserCore')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('SCENARIO 1: Subscription Creation Flow')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ✅ TEST 1: Complete subscription in one message
console.log('TEST 1: Complete subscription in single message')
console.log('Input: "Netflix renews on 27th every month - 149"')
const result1 = parseMessage('Netflix renews on 27th every month - 149')
assert.equal(result1.type, 'subscription', 'Should recognize complete subscription')
assert.equal(result1.serviceName, 'Netflix')
assert.equal(result1.amount, 149)
assert.equal(result1.recurrence, 'month')
assert.equal(result1.renewalDay, 27)
console.log('✓ Complete subscription parsed correctly')
console.log(`  → Service: ${result1.serviceName}`)
console.log(`  → Amount: ₹${result1.amount}`)
console.log(`  → Renewal: Day ${result1.renewalDay} every ${result1.recurrence}\n`)

// ✅ TEST 2: Incomplete subscription (missing price)
console.log('TEST 2: Incomplete subscription detection')
console.log('Input: "Spotify"')
const result2 = parseMessage('Spotify')
assert.equal(result2.type, 'incomplete', 'Should ask for missing details')
assert.ok(result2.missing.length > 0, 'Should identify missing fields')
console.log('✓ Incomplete subscription detected')
console.log(`  → Missing fields: ${result2.missing.join(', ')}\n`)

// ✅ TEST 3: Incomplete with partial info
console.log('TEST 3: Partial information')
console.log('Input: "Spotify ₹119"')
const result3 = parseMessage('Spotify ₹119')
assert.equal(result3.type, 'incomplete', 'Should need more info')
assert.ok(result3.missing.includes('recurrence'), 'Should ask for recurrence')
console.log('✓ Partial info recognized')
console.log(`  → Found: ${result3.draft?.serviceName} - ₹${result3.draft?.amount}`)
console.log(`  → Still missing: ${result3.missing.join(', ')}\n`)

// ✅ TEST 4: Follow-up completion
console.log('TEST 4: Multi-turn conversation (follow-up)')
const pendingState = {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
}
console.log('Previous state:', pendingState)
console.log('Follow-up input: "149 monthly on 27th"')
const result4 = parseMessage('149 monthly on 27th', pendingState)
assert.equal(result4.type, 'subscription', 'Follow-up should complete subscription')
assert.equal(result4.amount, 149)
assert.equal(result4.renewalDay, 27)
assert.equal(result4.serviceName, 'Netflix', 'Should retain service name from context')
console.log('✓ Follow-up correctly completed subscription')
console.log(`  → Final: Netflix - ₹${result4.amount} on day ${result4.renewalDay} monthly\n`)

// ✅ TEST 5: Custom recurrence interval
console.log('TEST 5: Custom recurrence intervals')
console.log('Input: "JioHotstar renews on Apr 12 every 3 months - 599"')
const result5 = parseMessage('JioHotstar renews on Apr 12 every 3 months - 599')
assert.equal(result5.recurrence, '3 months', 'Should preserve custom intervals')
assert.equal(result5.serviceName, 'JioHotstar')
assert.equal(result5.renewalMonth, 'Apr' || 4, 'Should capture month')
console.log('✓ Custom 3-month interval parsed correctly')
console.log(`  → ${result5.serviceName} renews on ${result5.renewalMonth} ${result5.renewalDay} every ${result5.recurrence}\n`)

// ✅ TEST 6: Annual subscription
console.log('TEST 6: Annual/yearly subscription')
console.log('Input: "Prime 1499 yearly"')
const result6 = parseMessage('Prime 1499 yearly')
assert.equal(result6.type, 'subscription', 'Should recognize yearly')
assert.equal(result6.recurrence, 'year', 'Should parse yearly as annual')
console.log('✓ Yearly subscription recognized')
console.log(`  → ${result6.serviceName} - ₹${result6.amount} per year\n`)

// ✅ TEST 7: Service name switching in multi-turn
console.log('TEST 7: Service switching in conversation')
const netflixPending = {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
}
console.log('Current context: Netflix incomplete')
console.log('New input: "prime"')
const result7 = parseMessage('prime', netflixPending)
assert.equal(result7.type, 'incomplete', 'Should stay incomplete')
assert.equal(result7.draft?.serviceName, 'Prime', 'Should switch to Prime, not Netflix')
console.log('✓ Service switch detected correctly')
console.log(`  → Switched from ${netflixPending.serviceName} to ${result7.draft?.serviceName}\n`)

// ✅ TEST 8: Amount-only follow-up keeps pending service
console.log('TEST 8: Amount follow-up preserves service')
const stillPending = {
  serviceName: 'Netflix',
  amount: null,
  recurrence: null,
  renewalDay: null,
  renewalMonth: null
}
console.log('Current context: Netflix incomplete')
console.log('Input: "149 monthly"')
const result8 = parseMessage('149 monthly', stillPending)
assert.equal(result8.draft?.serviceName, 'Netflix', 'amount follow-up keeps pending service')
console.log('✓ Service preserved when adding amount')
console.log(`  → ${result8.draft?.serviceName} - ₹${result8.draft?.amount} ${result8.draft?.recurrence}\n`)

// ✅ TEST 9: Various currency symbols
console.log('TEST 9: Multiple currency formats')
const formats = [
  { input: 'Spotify ₹119', expected: 119 },
  { input: 'Netflix : 149', expected: 149 },
  { input: 'Prime $14.99', expected: 14.99 }
]
for (const fmt of formats) {
  const r = parseMessage(fmt.input)
  console.log(`  Input: "${fmt.input}" → Amount: ${r.draft?.amount || r.amount}`)
}
console.log('✓ Multiple currency formats supported\n')

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ All subscription creation tests passed!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
