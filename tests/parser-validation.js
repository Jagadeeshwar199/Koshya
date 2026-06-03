#!/usr/bin/env node
const { detectIntent, detectClauseIntents } = require('../src/services/intentService')
const cases = require('./parser-validation-cases')

const EXP = {
  reminder: (r) => r.intent === 'REMINDER_CREATE',
  subscription_renewal: (r) => r.intent === 'SUBSCRIPTION_CREATE',
  subscription_expiry: (r) =>
    r.intent === 'SUBSCRIPTION_EXPIRY' || (r.intent === 'SUBSCRIPTION_QUERY' && r.entities.queryType === 'expiry'),
  ambiguous: (r) => r.intent === 'UNKNOWN' && r.entities.clarify === 'short'
}

function normType(r) {
  if (r.intent === 'REMINDER_CREATE') return 'reminder'
  if (r.intent === 'SUBSCRIPTION_CREATE') return 'subscription_renewal'
  if (r.intent === 'SUBSCRIPTION_EXPIRY' || (r.intent === 'SUBSCRIPTION_QUERY' && r.entities.queryType === 'expiry')) {
    return 'subscription_expiry'
  }
  return r.intent
}

function multiTypes(msg) {
  const got = new Set()
  const m = msg.match(/^(.*?)(?:remind(?:ar)?\s+me\s+|notify\s+me\s+)(.+)$/i)
  if (m) {
    got.add(normType(detectIntent(m[1])))
    got.add(normType(detectIntent(m[2])))
  }
  for (const p of msg.split(/\s+and\s+/i)) {
    if (p.trim().length > 3) got.add(normType(detectIntent(p.trim())))
  }
  if (!got.size) got.add(normType(detectIntent(msg)))
  return got
}

function runMulti(msg, need) {
  const got = new Set(detectClauseIntents(msg).map(normType))
  return need.every((t) => got.has(t))
}

function checkEntities(r, req) {
  if (req.d && !r.entities.date) return 'date not extracted'
  if (req.s && !r.entities.serviceName) return 'service not extracted'
  if (req.r && !r.entities.recurrence) return 'recurrence not extracted'
  if (req.q && r.entities.queryType !== req.q) return 'queryType mismatch'
  return null
}

function classify(reason, exp) {
  if (!reason) return null
  const r = reason.toLowerCase()
  if (/fuzzy|typo|spelling|garbage|whatsapp/i.test(r + exp)) return 'Fuzzy matching'
  if (/date|time|offset|midnight|tomorrow/i.test(r)) return 'Date parsing'
  if (/service|recurrence|entity|querytype/i.test(r)) return 'Entity extraction'
  if (/intent|multi|expected/i.test(r)) return 'Intent classification'
  if (/multi/i.test(exp)) return 'Multi-intent parsing'
  return 'Intent classification'
}

const rows = []
const reasons = {}

for (const [cat, exp, msg, req] of cases) {
  const r = detectIntent(msg)
  let ok = false
  let reason = ''

  if (exp === 'multi') {
    ok = runMulti(msg, req.multi || [])
    if (!ok) reason = `expected multi ${req.multi.join('+')}, got ${normType(r)}`
  } else {
    ok = EXP[exp](r)
    if (!ok) reason = `expected ${exp}, got ${normType(r)}`
    if (ok) {
      const er = checkEntities(r, req)
      if (er) {
        ok = false
        reason = er
      }
    }
  }

  const label = exp === 'multi' ? 'Multi' : exp.replace('subscription_', 'Subscription').replace(/^./, (x) => x.toUpperCase())
  rows.push({ cat, label, msg, ok, reason })
  if (!ok) reasons[reason] = (reasons[reason] || 0) + 1
}

const passed = rows.filter((x) => x.ok).length
const failed = rows.length - passed
const groups = {}

for (const row of rows.filter((x) => !x.ok)) {
  const g = classify(row.reason, row.label)
  groups[g] = (groups[g] || 0) + 1
}

for (const row of rows) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} | ${row.label} | "${row.msg}"`)
  if (!row.ok) console.log(`Reason: ${row.reason}`)
}

const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 20)
console.log('\nSummary:')
console.log(`Total: ${rows.length}`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`Pass Rate: ${((passed / rows.length) * 100).toFixed(1)}%`)
console.log('\nFailure Groups:')
for (const [g, n] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
  console.log(`* ${g}: ${n}`)
}
console.log('\nTop Failure Reasons:')
top.forEach(([r, n], i) => console.log(`${i + 1}. (${n}) ${r}`))
const rec = [
  ['Multi-intent clause splitter in intentDetector', groups['Multi-intent parsing'] || groups['Intent classification']],
  ['Typo dictionary expansion (WhatsApp/garbage)', groups['Fuzzy matching']],
  ['Relative date: day after tomorrow, midnight', groups['Date parsing']],
  ['NL expiry: wont work, finishes this month', groups['Entity extraction']]
].filter(([, n]) => n).sort((a, b) => b[1] - a[1])
if (rec.length) {
  console.log('\nRecommended fixes (by impact):')
  rec.forEach(([t, n], i) => console.log(`${i + 1}. ${t} (${n} failures)`))
}

process.exit(failed ? 1 : 0)
