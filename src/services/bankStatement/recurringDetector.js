const { classifyTransaction } = require('./transactionClassifier')

const SUB = /\b(?:NETFLIX|SPOTIFY|PRIME|HOTSTAR|DISNEY|YOUTUBE|APPLE|MICROSOFT|ADOBE|FIBERNET)\b/i

function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000
}

function median(nums) {
  const s = [...nums].sort((x, y) => x - y)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function inferRecurrence(intervals) {
  const med = median(intervals)
  if (med == null) return null
  if (med >= 25 && med <= 35) return 'monthly'
  if (med >= 85 && med <= 95) return '3 months'
  if (med >= 350 && med <= 380) return 'yearly'
  return `${Math.round(med / 30)} months`
}

function detectRecurringGroups(merchantGroups) {
  const results = []
  for (const group of merchantGroups) {
    const debits = group.txns
      .filter((t) => t.debitCredit !== 'credit')
      .filter((t) => classifyTransaction(t.description) !== 'loan_repayment')
      .filter((t) => !['transfer', 'shopping'].includes(classifyTransaction(t.description)) || SUB.test(group.normalizedName))

    if (debits.length < 2) continue

    const dated = debits.filter((t) => t.txnDate).sort((a, b) => a.txnDate.localeCompare(b.txnDate))
    const intervals = []
    for (let i = 1; i < dated.length; i++) {
      intervals.push(daysBetween(dated[i - 1].txnDate, dated[i].txnDate))
    }

    const amounts = debits.map((t) => t.amount)
    const medAmt = median(amounts)
    const sameAmount = amounts.every((a) => Math.abs(a - medAmt) <= Math.max(5, medAmt * 0.05))

    results.push({
      merchantKey: group.merchantKey,
      normalizedName: group.normalizedName,
      rawNames: group.rawNames,
      transactions: debits,
      occurrenceCount: debits.length,
      medianAmount: medAmt,
      sameAmount,
      intervals,
      recurrence: inferRecurrence(intervals),
      dominantType: classifyTransaction(group.normalizedName)
    })
  }
  return results
}

module.exports = { detectRecurringGroups, inferRecurrence, median }
