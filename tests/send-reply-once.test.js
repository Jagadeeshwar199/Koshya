#!/usr/bin/env node
const assert = require('node:assert/strict')
const { sendReplyOnce } = require('../src/services/whatsappService')

let calls = 0
;(async () => {
  const id = 'msg-dup-test'
  const r1 = await sendReplyOnce(id, async () => {
    calls++
    return { success: true }
  })
  const r2 = await sendReplyOnce(id, async () => {
    calls++
    return { success: true }
  })
  assert.equal(calls, 1)
  assert.equal(r1.success, true)
  assert.equal(r2.duplicateBlocked, true)
  console.log('sendReplyOnce tests passed: 2')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
