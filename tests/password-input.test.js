#!/usr/bin/env node
const assert = require('node:assert/strict')
const { isPasswordCancel, isPlausiblePassword } = require('../src/utils/passwordInput')

assert.equal(isPasswordCancel('cancel'), true)
assert.equal(isPasswordCancel('Cancel'), true)
assert.equal(isPlausiblePassword('abc'), false)
assert.equal(isPlausiblePassword('goodpass1'), true)
assert.equal(isPlausiblePassword('has space'), false)
assert.equal(isPlausiblePassword('line\nbreak'), false)

console.log('Password input tests passed: 6')
