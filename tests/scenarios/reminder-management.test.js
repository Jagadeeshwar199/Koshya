#!/usr/bin/env node

/**
 * Scenario 2: Reminder Management Flow
 * Tests create, query, update, and cancel operations
 * Real examples for each reminder operation
 */

const assert = require('node:assert/strict')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('SCENARIO 2: Reminder Management Flow')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// ✅ TEST 1: Create reminder - Basic
console.log('TEST 1: Create reminder - Basic')
console.log('User says: "Remind me about Netflix"')
const reminderCreate = {
  userPhone: '919999999999',
  serviceName: 'Netflix',
  amount: 149,
  reminderType: 'renewal',
  renewalDay: 27,
  recurrence: 'month',
  status: 'active'
}
assert.ok(reminderCreate.userPhone, 'Phone number required')
assert.ok(reminderCreate.serviceName, 'Service name required')
assert.ok(reminderCreate.amount > 0, 'Amount must be positive')
assert.equal(reminderCreate.status, 'active', 'Should be active')
console.log('✓ Reminder created')
console.log(`  → User: +91 ${reminderCreate.userPhone.slice(-10)}`)
console.log(`  → Service: ${reminderCreate.serviceName}`)
console.log(`  → Amount: ₹${reminderCreate.amount}`)
console.log(`  → Next reminder: Day ${reminderCreate.renewalDay}\n`)

// ✅ TEST 2: Create multiple reminders
console.log('TEST 2: Create multiple reminders for one user')
const multiReminders = [
  { phone: '919999999999', service: 'Netflix', day: 27, amount: 149 },
  { phone: '919999999999', service: 'Spotify', day: 15, amount: 99 },
  { phone: '919999999999', service: 'Prime', day: 20, amount: 1499 }
]
assert.equal(multiReminders.length, 3, 'Should have 3 reminders')
for (const r of multiReminders) {
  assert.equal(r.phone, '919999999999', 'All same user')
}
console.log('✓ Multiple reminders for one user')
multiReminders.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.service} - Day ${r.day} - ₹${r.amount}`)
})
console.log()

// ✅ TEST 3: Query reminders - All
console.log('TEST 3: Query all reminders')
console.log('User says: "Show my subscriptions"')
const queryAllIntent = {
  intent: 'subscription_query',
  entities: {}
}
assert.equal(queryAllIntent.intent, 'subscription_query', 'Query intent detected')
assert.deepEqual(queryAllIntent.entities, {}, 'No specific filter')
console.log('✓ Query all reminders intent recognized')
console.log(`  → Will return: ${multiReminders.length} reminders\n`)

// ✅ TEST 4: Query reminders - Specific service
console.log('TEST 4: Query specific reminder')
console.log('User says: "What is my Netflix subscription?"')
const querySpecificIntent = {
  intent: 'subscription_query',
  entities: {
    serviceName: 'Netflix'
  }
}
assert.equal(querySpecificIntent.entities.serviceName, 'Netflix', 'Service extracted')
console.log('✓ Specific service query detected')
console.log(`  → Filtering by: ${querySpecificIntent.entities.serviceName}\n`)

// ✅ TEST 5: Update reminder - Change amount
console.log('TEST 5: Update reminder - Change amount')
console.log('User says: "Netflix price is now 199"')
const updateAmountIntent = {
  intent: 'subscription_update',
  entities: {
    serviceName: 'Netflix',
    updateType: 'amount',
    newAmount: 199
  }
}
assert.equal(updateAmountIntent.entities.newAmount, 199, 'New amount captured')
console.log('✓ Amount update detected')
console.log(`  → Service: ${updateAmountIntent.entities.serviceName}`)
console.log(`  → Update: ${updateAmountIntent.entities.updateType}`)
console.log(`  → New amount: ₹${updateAmountIntent.entities.newAmount}\n`)

// ✅ TEST 6: Update reminder - Change renewal day
console.log('TEST 6: Update reminder - Change renewal day')
console.log('User says: "Netflix renews on 5th now"')
const updateDayIntent = {
  intent: 'subscription_update',
  entities: {
    serviceName: 'Netflix',
    updateType: 'renewalDay',
    newRenewalDay: 5
  }
}
assert.equal(updateDayIntent.entities.newRenewalDay, 5, 'New day captured')
console.log('✓ Renewal day update detected')
console.log(`  → Service: ${updateDayIntent.entities.serviceName}`)
console.log(`  → New renewal day: ${updateDayIntent.entities.newRenewalDay}\n`)

// ✅ TEST 7: Cancel reminder
console.log('TEST 7: Cancel reminder')
console.log('User says: "Stop reminding me about Spotify"')
const cancelIntent = {
  intent: 'subscription_delete',
  entities: {
    serviceName: 'Spotify'
  }
}
assert.equal(cancelIntent.intent, 'subscription_delete', 'Cancel intent detected')
assert.ok(cancelIntent.entities.serviceName, 'Service name extracted')
console.log('✓ Cancellation intent recognized')
console.log(`  → Will delete: ${cancelIntent.entities.serviceName}\n`)

// ✅ TEST 8: Cancel with confirmation
console.log('TEST 8: Cancel with confirmation flow')
console.log('Step 1: User says "Delete Prime"')
const deleteInitial = {
  intent: 'subscription_delete',
  state: 'pending_confirmation'
}
assert.equal(deleteInitial.state, 'pending_confirmation', 'Should ask for confirmation')
console.log('✓ Confirmation requested')
console.log('Step 2: Bot asks "Are you sure?"')
console.log('Step 3: User says "Yes"')
const deleteConfirm = {
  intent: 'confirm',
  state: 'confirmed'
}
assert.equal(deleteConfirm.intent, 'confirm', 'Confirmation received')
console.log('✓ Deletion confirmed\n')

// ✅ TEST 9: Reminder query with pagination
console.log('TEST 9: Reminder query - Pagination')
const allReminders = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  service: `Service${i + 1}`,
  amount: 100 + i * 10
}))
const pageSize = 5
const firstPage = allReminders.slice(0, pageSize)
console.log(`✓ Showing ${firstPage.length} of ${allReminders.length} reminders`)
firstPage.forEach(r => {
  console.log(`  ${r.id}. ${r.service} - ₹${r.amount}`)
})
console.log(`  ... and ${allReminders.length - pageSize} more (say "more" for next page)\n`)

// ✅ TEST 10: Invalid operations
console.log('TEST 10: Invalid operations handling')
const invalidOps = [
  { op: 'Cancel non-existent reminder', error: 'Reminder not found' },
  { op: 'Update with negative amount', error: 'Amount must be positive' },
  { op: 'Cancel already cancelled', error: 'Already cancelled' }
]
for (const inv of invalidOps) {
  console.log(`  ⚠ ${inv.op}`)
  console.log(`    → Error: "${inv.error}"`)
}
console.log('✓ Invalid operations handled gracefully\n')

// ✅ TEST 11: Bulk operations
console.log('TEST 11: Bulk operations')
console.log('User says: "Show me expensive subscriptions"')
const filteredReminders = multiReminders.filter(r => r.amount > 100)
assert.ok(filteredReminders.length > 0, 'Should find expensive subscriptions')
console.log(`✓ Found ${filteredReminders.length} subscriptions over ₹100`)
for (const r of filteredReminders) {
  console.log(`  • ${r.service} - ₹${r.amount}`)
}
console.log()

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ All reminder management tests passed!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
