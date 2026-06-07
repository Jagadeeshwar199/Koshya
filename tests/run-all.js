#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const tests = [
  'test:parser',
  'test:intents',
  'test:intent-semantic',
  'test:user-intent-examples',
  'test:intent-router',
  'tests/shadow-detection.test.js',
  'tests/detection-engine.test.js',
  'tests/weak-intent-guard.test.js',
  'tests/ai-learning.test.js',
  'tests/koshya-response-layer.test.js',
  'tests/intent-route-source.test.js',
  'tests/ai-update-detection.test.js',
  'tests/send-reply-once.test.js',
  'test:reminders',
  'test:reminder-title',
  'test:reminder-schedule',
  'test:subscription-display',
  'test:subscription-pending',
  'test:subscription-amount',
  'test:ux-minimal',
  'test:reminder-confirmation',
  'test:reminder-query',
  'test:reminder-update',
  'tests/entity-update-inplace.test.js',
  'test:day13',
  'test:webhook-auth',
  'tests/security-rollout.test.js',
  'tests/production-bugs.test.js',
  'tests/production-ux-bugs.test.js',
  'tests/delete-flow.test.js',
  'test:ux',
  'test:api'
]

for (const test of tests) {
  const result = test.endsWith('.js')
    ? spawnSync('node', [test], { stdio: 'inherit', env: process.env })
    : spawnSync('npm', ['run', test], { stdio: 'inherit', env: process.env })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

console.log(`All ${tests.length} test suites passed.`)
