const assert = require('node:assert/strict')
const { detectIntent, INTENTS } = require('../src/services/intentService')
const { unknownReply, clarifyLowConfidence, HELP_TEXT, WELCOME_TEXT } = require('../src/utils/uxMessages')

assert.match(HELP_TEXT, /Show subscriptions/)
assert.match(WELCOME_TEXT, /Netflix renews/)
assert.match(unknownReply('blah'), /help/)
assert.match(unknownReply('delete'), /Delete Netflix/)
assert.ok(clarifyLowConfidence(INTENTS.REMINDER_CREATE))
assert.equal(detectIntent('Delete').intent, INTENTS.SUBSCRIPTION_DELETE)
assert.equal(detectIntent('dont let me forget to pay rent').intent, INTENTS.REMINDER_CREATE)
assert.equal(detectIntent('netflix 149 every month').intent, INTENTS.SUBSCRIPTION_CREATE)

console.log('UX tests passed: 8')
