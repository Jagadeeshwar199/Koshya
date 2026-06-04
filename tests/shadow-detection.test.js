#!/usr/bin/env node
const assert = require('node:assert/strict')
const { Domain, Action } = require('../src/detection/types')
const { runShadowDetection } = require('../src/detection/shadowPipeline')

const r = runShadowDetection('Remind me tomorrow about milk')
assert.equal(r.domain, Domain.REMINDER)
assert.equal(r.action, Action.CREATE)
assert.ok(r.reasons.length > 0)
assert.equal(r.usedAI, false)

const q = runShadowDetection('show my subscriptions')
assert.equal(q.domain, Domain.SUBSCRIPTION)
assert.equal(q.action, Action.QUERY)

console.log('Shadow detection tests passed: 2')
