const { extractPdfTransactions } = require('./pdfParserService')

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      q = !q
      continue
    }
    if (c === ',' && !q) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

function parseAmount(raw) {
  const n = Number(String(raw || '').replace(/[,₹]/g, '').trim())
  return Number.isFinite(n) ? Math.abs(n) : null
}

function parseDate(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const y = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
    return `${y}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`
  }
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10)
  return null
}

function extractTransactionsFromCsv(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)))

  const dateIdx = idx(['date', 'txn date', 'transaction date'])
  const descIdx = idx(['description', 'narration', 'particulars', 'details'])
  const debitIdx = idx(['debit', 'withdrawal'])
  const creditIdx = idx(['credit', 'deposit'])
  const amtIdx = idx(['amount'])

  const txns = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const description = descIdx >= 0 ? cols[descIdx] : cols[1] || cols[0]
    if (!description) continue

    let amount = amtIdx >= 0 ? parseAmount(cols[amtIdx]) : null
    let debitCredit = 'unknown'
    const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx]) : null
    const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx]) : null
    if (debit) {
      amount = debit
      debitCredit = 'debit'
    } else if (credit) {
      amount = credit
      debitCredit = 'credit'
    }
    if (amount == null) continue

    txns.push({
      txnDate: dateIdx >= 0 ? parseDate(cols[dateIdx]) : null,
      description: String(description).trim(),
      amount,
      debitCredit,
      rawLine: lines[i],
      rowIndex: i
    })
  }
  return txns
}

async function extractTransactions(content, fileType = 'csv', password = null) {
  if (fileType === 'csv' || fileType === 'text') {
    return { transactions: extractTransactionsFromCsv(content), bankName: null }
  }
  if (fileType === 'pdf') {
    const buffer = Buffer.from(String(content || ''), 'base64')
    return extractPdfTransactions(buffer, password)
  }
  return { transactions: [], bankName: null }
}

module.exports = { extractTransactions, extractTransactionsFromCsv, parseCsvLine }
