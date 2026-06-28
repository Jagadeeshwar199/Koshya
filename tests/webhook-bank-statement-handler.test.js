#!/usr/bin/env node
const assert = require('node:assert/strict')
const Module = require('node:module')

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
process.env.GUPSHUP_SOURCE_PHONE = '15550001111'
process.env.GUPSHUP_API_KEY = 'test-key'

const sent = []
let analyzeCalls = []
let cleared = false
const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request.endsWith('gupshupMediaService')) {
    return {
      resolveFileType: () => 'pdf',
      prepareStatementContent: () => 'base64pdf',
      downloadStatementFile: async () => ({ buffer: Buffer.from('pdf') })
    }
  }
  if (request.endsWith('bankStatement/detectionService')) {
    return {
      analyzeStatement: async (args) => {
        analyzeCalls.push(args)
        if (!args.password) {
          return {
            statementId: 'stmt-1',
            status: 'awaiting_password',
            transactionCount: 0,
            message: 'Reply with the PDF password to continue.'
          }
        }
        if (args.password === 'wrong') {
          return {
            statementId: 'stmt-1',
            status: 'awaiting_password',
            transactionCount: 0,
            message: 'Incorrect password. Please send the PDF password again.'
          }
        }
        return {
          statementId: 'stmt-1',
          status: 'awaiting_confirmation',
          transactionCount: 3,
          message: 'Reply YES to add these'
        }
      }
    }
  }
  if (request.endsWith('bankStatement/storeService')) {
    return {
      findAwaitingPasswordStatement: async () => ({
        id: 'stmt-1',
        file_name: 'stmt.pdf',
        file_type: 'pdf',
        raw_content: 'base64pdf',
        status: 'awaiting_password'
      }),
      clearAwaitingPasswordStatement: async () => {
        cleared = true
      }
    }
  }
  if (request.endsWith('whatsappService')) {
    return {
      sendWhatsAppMessage: async (_phone, text) => {
        sent.push(text)
        return { success: true }
      }
    }
  }
  if (request.endsWith('webhookIdempotencyService')) {
    return {
      isMessageProcessed: async () => false,
      markMessageProcessed: async () => {}
    }
  }
  return origLoad(request, parent, isMain)
}

const {
  handleBankStatementFile,
  handleAwaitingPasswordText
} = require('../src/controllers/webhookController')

const statement = {
  id: 'stmt-1',
  file_name: 'x.pdf',
  file_type: 'pdf',
  raw_content: 'base64pdf'
}

;(async () => {
  sent.length = 0
  analyzeCalls = []
  await handleBankStatementFile(
    '919999999999',
    {
      messageId: 'm1',
      file: { url: 'https://example.com/x.pdf', name: 'x.pdf', contentType: 'application/pdf' }
    },
    'upload-1'
  )
  assert.match(sent[0], /password/i)
  assert.equal(analyzeCalls[0].password, null)

  sent.length = 0
  analyzeCalls = []
  await handleAwaitingPasswordText('919999999999', statement, 'hello there', 'upload-2', 'm2')
  assert.match(sent[0], /waiting for your PDF password/i)
  assert.equal(analyzeCalls.length, 0)

  sent.length = 0
  cleared = false
  await handleAwaitingPasswordText('919999999999', statement, 'cancel', 'upload-3', 'm3')
  assert.equal(cleared, true)
  assert.match(sent[0], /cancelled/i)

  sent.length = 0
  analyzeCalls = []
  await handleAwaitingPasswordText('919999999999', statement, 'wrong', 'upload-4', 'm4')
  assert.match(sent[0], /Incorrect password/i)

  sent.length = 0
  analyzeCalls = []
  await handleAwaitingPasswordText('919999999999', statement, 'secret123', 'upload-5', 'm5')
  assert.match(sent[0], /Reply YES/i)
  assert.equal(analyzeCalls[0].password, 'secret123')
  assert.equal(analyzeCalls[0].uploadId, 'upload-5')
})().then(() => {
  console.log('Webhook bank statement handler tests passed: 5')
})
