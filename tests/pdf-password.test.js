#!/usr/bin/env node
const assert = require('node:assert/strict')
const axios = require('axios')
const { extractPdfTransactions } = require('../src/services/bankStatement/pdfParserService')

const PROTECTED_URL = 'https://mehmet-kozan.github.io/pdf-parse/pdf/password-123456.pdf'
const OPEN_URL = 'https://pdfobject.com/pdf/sample.pdf'

async function download(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
  return Buffer.from(res.data)
}

;(async () => {
  const open = await download(OPEN_URL)
  const openResult = await extractPdfTransactions(open, null)
  assert.equal(openResult.parseOutcome, 'success')
  assert.ok(openResult.text.length > 0)

  const protectedPdf = await download(PROTECTED_URL)
  const locked = await extractPdfTransactions(protectedPdf, null)
  assert.equal(locked.parseOutcome, 'password_needed')
  assert.equal(locked.parseErrorType, 'PasswordException')

  const wrong = await extractPdfTransactions(protectedPdf, 'wrong1')
  assert.equal(wrong.parseOutcome, 'incorrect_password')
  assert.match(wrong.parseErrorMessage, /incorrect password/i)

  const unlocked = await extractPdfTransactions(protectedPdf, '123456')
  assert.equal(unlocked.parseOutcome, 'success')
  assert.ok(unlocked.text.length > 100)

  console.log('PDF password parser tests passed: 4')
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
