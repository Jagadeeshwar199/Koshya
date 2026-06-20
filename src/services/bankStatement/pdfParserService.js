const BANK_PATTERNS = {
  hdfc: /\bHDFC BANK\b/i,
  icici: /\bICICI BANK\b/i,
  sbi: /\bSTATE BANK OF INDIA\b|\bSBI\b/i,
  axis: /\bAXIS BANK\b/i
}

function detectBank(text) {
  for (const [bank, re] of Object.entries(BANK_PATTERNS)) {
    if (re.test(text)) return bank
  }
  return 'generic'
}

function parseAmount(raw) {
  const n = Number(String(raw || '').replace(/[,₹]/g, '').trim())
  return Number.isFinite(n) ? Math.abs(n) : null
}

function parsePdfDate(raw) {
  const s = String(raw || '').trim()
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const y = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
    return `${y}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`
  }
  const dmy2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (dmy2) {
    const y = Number(dmy2[3].length === 2 ? `20${dmy2[3]}` : dmy2[3])
    return `${y}-${String(dmy2[2]).padStart(2, '0')}-${String(dmy2[1]).padStart(2, '0')}`
  }
  return null
}

function parsePdfLine(line, bank) {
  const trimmed = String(line || '').trim()
  if (!trimmed || trimmed.length < 8) return null
  if (/^(date|txn|transaction|narration|particulars|debit|credit|balance)/i.test(trimmed)) return null

  const generic = trimmed.match(
    /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s*$/
  )
  if (generic) {
    const amount = parseAmount(generic[3])
    if (!amount) return null
    return {
      txnDate: parsePdfDate(generic[1]),
      description: generic[2].trim(),
      amount,
      debitCredit: 'debit',
      rawLine: trimmed
    }
  }

  const icici = trimmed.match(/^(\d{2}[/-]\d{2}[/-]\d{4})\s+(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)?/)
  if (icici && (bank === 'icici' || bank === 'generic')) {
    const debit = parseAmount(icici[3])
    const credit = parseAmount(icici[4])
    if (debit) return { txnDate: parsePdfDate(icici[1]), description: icici[2].trim(), amount: debit, debitCredit: 'debit', rawLine: trimmed }
    if (credit) return { txnDate: parsePdfDate(icici[1]), description: icici[2].trim(), amount: credit, debitCredit: 'credit', rawLine: trimmed }
  }

  const amtTail = trimmed.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+)\s+(\d[\d,]*(?:\.\d+)?)$/)
  if (amtTail) {
    const amount = parseAmount(amtTail[3])
    if (amount) {
      return {
        txnDate: parsePdfDate(amtTail[1]),
        description: amtTail[2].trim(),
        amount,
        debitCredit: 'debit',
        rawLine: trimmed
      }
    }
  }
  return null
}

function extractTransactionsFromPdfText(text, bank = 'generic') {
  const lines = String(text || '').split(/\r?\n/)
  const txns = []
  for (let i = 0; i < lines.length; i++) {
    const txn = parsePdfLine(lines[i], bank)
    if (txn) txns.push({ ...txn, rowIndex: i })
  }
  return txns
}

async function extractPdfText(buffer, password) {
  let pdfParse
  try {
    pdfParse = require('pdf-parse')
  } catch (_) {
    return { error: 'pdf_parser_unavailable' }
  }
  try {
    const data = await pdfParse(buffer, password ? { password } : {})
    const text = data?.text || ''
    return { text, bank: detectBank(text) }
  } catch (err) {
    const msg = String(err?.message || err)
    if (/password|encrypted|decrypt/i.test(msg)) return { passwordRequired: true }
    return { error: msg }
  }
}

async function extractPdfTransactions(buffer, password) {
  const extracted = await extractPdfText(buffer, password)
  if (extracted.passwordRequired) return { passwordRequired: true }
  if (extracted.error) return { error: extracted.error }
  return {
    bank: extracted.bank,
    transactions: extractTransactionsFromPdfText(extracted.text, extracted.bank),
    text: extracted.text
  }
}

module.exports = {
  detectBank,
  extractPdfText,
  extractPdfTransactions,
  extractTransactionsFromPdfText
}
