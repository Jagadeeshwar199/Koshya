#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const tests = [
  'test:parser',
  'test:intents',
  'test:intent-router',
  'test:reminders',
  'test:reminder-confirmation',
  'test:reminder-query',
  'test:reminder-update',
  'test:day13',
  'test:webhook-auth',
  'test:api'
]

for (const test of tests) {
  const result = spawnSync('npm', ['run', test], {
    stdio: 'inherit',
    env: process.env
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

console.log(`All ${tests.length} test suites passed.`)
