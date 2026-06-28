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

function renderPdfPage(pageData) {
  const renderOptions = {
    normalizeWhitespace: false,
    disableCombineTextItems: false
  }
  return pageData.getTextContent(renderOptions).then((textContent) => {
    let lastY
    let text = ''
    for (const item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str
      } else {
        text += `\n${item.str}`
      }
      lastY = item.transform[5]
    }
    return text
  })
}

let pdfJsModule = null

function getPdfJs() {
  if (!pdfJsModule) {
    try {
      pdfJsModule = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
    } catch (_) {
      return null
    }
    pdfJsModule.disableWorker = true
  }
  return pdfJsModule
}

async function parsePdfBuffer(buffer, password = null) {
  const PDFJS = getPdfJs()
  if (!PDFJS) {
    throw new Error('pdf_parser_unavailable')
  }
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const src = password ? { data, password: String(password) } : { data }
  const doc = await PDFJS.getDocument(src)
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const pageText = await doc
      .getPage(i)
      .then((pageData) => renderPdfPage(pageData))
      .catch(() => '')
    text = `${text}\n\n${pageText}`
  }
  doc.destroy()
  return text
}

function classifyPdfError(err, passwordSupplied) {
  const msg = String(err?.message || err)
  const parseErrorType = err?.name || 'Error'
  const parseErrorMessage = msg

  if (err?.code === 2 || /incorrect password/i.test(msg)) {
    return { parseOutcome: 'incorrect_password', parseErrorType, parseErrorMessage }
  }
  if (err?.code === 1 || /no password given/i.test(msg)) {
    if (passwordSupplied) {
      return { parseOutcome: 'implementation_error', parseErrorType, parseErrorMessage }
    }
    return { parseOutcome: 'password_needed', parseErrorType, parseErrorMessage }
  }
  return { parseOutcome: 'error', parseErrorType, parseErrorMessage, error: msg }
}

async function extractPdfText(buffer, password) {
  if (!getPdfJs()) {
    return { parseOutcome: 'error', parseErrorType: 'Error', parseErrorMessage: 'pdf_parser_unavailable', error: 'pdf_parser_unavailable' }
  }
  const passwordSupplied = Boolean(password && String(password).trim())
  try {
    const text = await parsePdfBuffer(buffer, passwordSupplied ? String(password).trim() : null)
    return { parseOutcome: 'success', text, bank: detectBank(text) }
  } catch (err) {
    return classifyPdfError(err, passwordSupplied)
  }
}

async function extractPdfTransactions(buffer, password) {
  const extracted = await extractPdfText(buffer, password)
  if (extracted.parseOutcome === 'success') {
    return {
      parseOutcome: 'success',
      bank: extracted.bank,
      transactions: extractTransactionsFromPdfText(extracted.text, extracted.bank),
      text: extracted.text
    }
  }
  return extracted
}

module.exports = {
  detectBank,
  extractPdfText,
  extractPdfTransactions,
  extractTransactionsFromPdfText
}
