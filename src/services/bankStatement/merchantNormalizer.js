function normalizeMerchant(description) {
  let s = String(description || '')
    .toUpperCase()
    .replace(/\b(?:UPI|PAYTM|GPAY|PHONEPE)[-/@\w.]+\b/gi, ' ')
    .replace(/\bNEFT\b|\bIMPS\b|\bRTGS\b|\bACH\b|\bECS\b/gi, ' ')
    .replace(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const stop = new Set(['LTD', 'LIMITED', 'PVT', 'PRIVATE', 'INDIA', 'PAYMENT', 'PAY', 'DEBIT', 'CREDIT'])
  const words = s.split(' ').filter((w) => w && !stop.has(w))
  return words.slice(0, 3).join(' ') || s.slice(0, 40) || 'UNKNOWN'
}

function merchantKey(description) {
  return normalizeMerchant(description).toLowerCase().replace(/\s+/g, '_')
}

function groupByMerchant(transactions) {
  const map = new Map()
  for (const txn of transactions) {
    const key = merchantKey(txn.description)
    if (!map.has(key)) {
      map.set(key, { merchantKey: key, normalizedName: normalizeMerchant(txn.description), rawNames: new Set(), txns: [] })
    }
    const g = map.get(key)
    g.rawNames.add(txn.description)
    g.txns.push(txn)
  }
  return [...map.values()].map((g) => ({ ...g, rawNames: [...g.rawNames] }))
}

module.exports = { normalizeMerchant, merchantKey, groupByMerchant }
