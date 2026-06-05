const { INTENTS } = require('./intentService')
const { clarifyLowConfidence, unknownReply } = require('../utils/uxMessages')
const {
  formatReminderConfirmation,
  formatReminderUpdateConfirmation,
  formatReminderCancelConfirmation
} = require('../formatters/reminderFormatter')
const {
  formatSubscriptionAdded,
  formatSubscriptionUpdated,
  formatSubscriptionRemoved
} = require('../formatters/subscriptionFormatter')

const VALID = new Set(Object.values(INTENTS))
const MAX_LINES = 4

function sanitizeGeminiHint(raw) {
  let s = String(raw || '')
  s = s.replace(/```[\s\S]*?```/g, '')
  s = s.replace(/\{[\s\S]*?\}/g, '')
  s = s.replace(/^\s*reasoning\s*[:=].*$/gim, '')
  s = s.replace(/confidence\s*[:=]\s*[\d.]+\s*%?/gi, '')
  s = s.replace(/\b(intent|entities|domain|action)\s*[:=].*$/gim, '')
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

function clampLines(text, max = MAX_LINES) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .join('\n')
}

function validateIntentName(intent) {
  return intent && VALID.has(intent) && intent !== INTENTS.UNKNOWN
}

function formatFromExecution(intentName, execResult) {
  if (!execResult || execResult.ok === false) return null
  if (execResult.reminder) {
    if (intentName === INTENTS.REMINDER_CANCEL) return formatReminderCancelConfirmation(execResult.reminder)
    if (intentName === INTENTS.REMINDER_UPDATE || intentName === INTENTS.REMINDER_RESCHEDULE) {
      return formatReminderUpdateConfirmation(execResult.reminder)
    }
    return formatReminderConfirmation(execResult.reminder)
  }
  if (execResult.subscription) {
    if (intentName === INTENTS.SUBSCRIPTION_DELETE) return formatSubscriptionRemoved(execResult.subscription)
    if (intentName === INTENTS.SUBSCRIPTION_UPDATE) return formatSubscriptionUpdated(execResult.subscription)
    return formatSubscriptionAdded({
      serviceName: execResult.subscription.serviceName,
      amount: execResult.subscription.amount,
      recurrence: execResult.subscription.recurrence
    })
  }
  if (execResult.parsed && intentName === INTENTS.SUBSCRIPTION_CREATE) {
    return formatSubscriptionAdded(execResult.parsed)
  }
  return null
}

function hintFromGemini(geminiRaw) {
  const clean = sanitizeGeminiHint(geminiRaw)
  if (!clean) return null
  const lines = clean.split('\n').filter((l) => l.trim())
  if (!lines.length) return null
  const head = lines[0].startsWith('✓') || lines[0].startsWith('✅') ? lines[0] : `✓ ${lines[0].replace(/^[✓✅]\s*/, '')}`
  return clampLines([head, ...lines.slice(1)].join('\n'))
}

function buildKoshyaResponse({ intent, entities, geminiRaw, execResult, validationOk }) {
  const geminiStored = geminiRaw ? String(geminiRaw) : null
  if (!validateIntentName(intent)) {
    return { text: clampLines(unknownReply(entities?.rawText || '')), geminiStored }
  }
  if (!validationOk) {
    const clarify = clarifyLowConfidence(intent) || unknownReply('')
    return { text: clampLines(clarify), geminiStored }
  }
  const fromExec = formatFromExecution(intent, execResult)
  if (fromExec) return { text: clampLines(fromExec), geminiStored }
  const hint = hintFromGemini(geminiRaw)
  if (hint) return { text: hint, geminiStored }
  return { text: clampLines(clarifyLowConfidence(intent) || 'Done.'), geminiStored }
}

module.exports = { buildKoshyaResponse, sanitizeGeminiHint, clampLines, MAX_LINES }
