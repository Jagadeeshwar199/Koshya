#!/usr/bin/env node
const assert = require('node:assert/strict')

const { extractTransactionsFromCsv } = require('../src/services/bankStatement/parserService')
const { normalizeMerchant, groupByMerchant } = require('../src/services/bankStatement/merchantNormalizer')
const { classifyTransaction } = require('../src/services/bankStatement/transactionClassifier')
const { detectRecurringGroups } = require('../src/services/bankStatement/recurringDetector')
const { scoreRecurringCandidate } = require('../src/services/bankStatement/confidenceScorer')
const {
  RULE_THRESHOLD,
  AI_MIN,
  AI_MAX,
  shouldUseAi
} = require('../src/services/bankStatement/aiReviewService')
const {
  formatConfirmationMessage,
  rejectionReason
} = require('../src/services/bankStatement/messageUtil')
const { hashContent } = require('../src/services/bankStatement/hashUtil')

const csv = `Date,Description,Debit,Credit
01/04/2026,NETFLIX.COM MUMBAI,649,
01/05/2026,NETFLIX.COM MUMBAI,649,
01/06/2026,NETFLIX.COM MUMBAI,649,
02/04/2026,HDFC PERSONAL LOAN EMI,12000,
01/04/2026,ACT FIBERNET BILL PAY,799,
01/05/2026,ACT FIBERNET BILL PAY,799,
01/06/2026,ACT FIBERNET BILL PAY,799,`

const txns = extractTransactionsFromCsv(csv)
assert.equal(txns.length, 7)
assert.equal(classifyTransaction('HDFC PERSONAL LOAN EMI'), 'loan_repayment')
assert.equal(classifyTransaction('NETFLIX.COM MUMBAI'), 'subscription')

const grouped = groupByMerchant(txns.filter((t) => classifyTransaction(t.description) !== 'loan_repayment'))
assert.ok(grouped.some((g) => g.normalizedName.includes('NETFLIX')))

const recurring = detectRecurringGroups(grouped)
const netflix = recurring.find((g) => g.normalizedName.includes('NETFLIX'))
assert.ok(netflix)
assert.equal(netflix.occurrenceCount, 3)
assert.equal(netflix.recurrence, 'monthly')

const scored = scoreRecurringCandidate(netflix)
assert.ok(scored.confidence >= RULE_THRESHOLD, `expected >= ${RULE_THRESHOLD}, got ${scored.confidence}`)
assert.equal(scored.ruleResult.isSubscription, true)
assert.equal(scored.breakdown.recurring, 15)
assert.equal(scored.breakdown.interval, 25)
assert.equal(scored.breakdown.merchant, 30)
assert.equal(scored.breakdown.total, scored.confidence)

assert.equal(normalizeMerchant('UPI-NETFLIX@paytm NETFLIX.COM'), 'NETFLIX COM')

assert.equal(shouldUseAi(55), true)
assert.equal(shouldUseAi(49), false)
assert.equal(shouldUseAi(70), false)
assert.equal(AI_MIN, 50)
assert.equal(AI_MAX, 69)

assert.equal(rejectionReason({ confidence: 40, ruleResult: { isSubscription: false } }), 'confidence_below_ai_minimum')
assert.equal(
  rejectionReason({ confidence: 75, ruleResult: { isSubscription: false } }),
  'not_a_subscription'
)

const confirmMsg = formatConfirmationMessage([
  { serviceName: 'Netflix', amount: 649, recurrence: 'monthly', confidence: 88 }
])
assert.match(confirmMsg, /Reply YES to add these/)

const { detectBank, extractTransactionsFromPdfText } = require('../src/services/bankStatement/pdfParserService')
assert.equal(detectBank('HDFC BANK statement'), 'hdfc')
const pdfTxns = extractTransactionsFromPdfText('01/04/2026 NETFLIX.COM 649\n01/05/2026 NETFLIX.COM 649', 'generic')
assert.equal(pdfTxns.length, 2)

const hashA = hashContent('same-content')
const hashB = hashContent('same-content')
assert.equal(hashA, hashB)
assert.notEqual(hashA, hashContent('other-content'))

console.log('Bank statement detection tests passed: 16')
