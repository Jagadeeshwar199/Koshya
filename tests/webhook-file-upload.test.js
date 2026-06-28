#!/usr/bin/env node
const assert = require('node:assert/strict')

const { parseWebhookMessage, parseGupshupFile } = require('../src/utils/webhookMessage')
const {
  resolveFileType,
  prepareStatementContent
} = require('../src/services/gupshupMediaService')

const gupshupPdf = {
  type: 'message',
  payload: {
    id: 'msg-1',
    source: '919999999999',
    type: 'file',
    payload: {
      name: 'statement.pdf',
      url: 'https://filemanager.gupshup.io/wa/test.pdf',
      contentType: 'application/pdf'
    }
  }
}

const gupshupCsv = {
  type: 'message',
  payload: {
    id: 'msg-2',
    source: '919999999999',
    type: 'file',
    payload: {
      name: 'statement.csv',
      url: 'https://filemanager.gupshup.io/wa/test.csv',
      contentType: 'text/csv'
    }
  }
}

const parsedPdf = parseWebhookMessage(gupshupPdf)
assert.equal(parsedPdf.file.name, 'statement.pdf')
assert.equal(parsedPdf.file.url.includes('gupshup.io'), true)
assert.equal(parsedPdf.text, undefined)

const parsedCsv = parseWebhookMessage(gupshupCsv)
assert.equal(resolveFileType(parsedCsv.file.name, parsedCsv.file.contentType), 'csv')

assert.equal(resolveFileType('x.pdf', 'application/pdf'), 'pdf')
assert.equal(resolveFileType('x.csv', 'text/csv'), 'csv')
assert.equal(resolveFileType('x.png', 'image/png'), null)

assert.equal(prepareStatementContent(Buffer.from('abc'), 'pdf'), Buffer.from('abc').toString('base64'))
assert.equal(prepareStatementContent(Buffer.from('a,b'), 'csv'), 'a,b')

assert.equal(parseGupshupFile({ type: 'text' }), null)

console.log('Webhook file upload tests passed: 8')
