const { INTENTS, detectIntent } = require('./intentService')
const { getLastEntity } = require('./entityContextService')
const { isCorrectionEntityName } = require('../intent/entityExtractor')
const { isCoercePassthroughIntent } = require('../intent/executableIntents')
const { parseFirst } = require('./parseFirstService')

const CLARIFY_UPDATE = 'CLARIFY_UPDATE'
const EDIT_SIGNAL = /\b(sorry|change|move|instead|make it|reschedule|update)\b/i

function normComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isSameReminderSignature(last, parseResult) {
  const lastTask = normComparable(last?.title)
  const lastSchedule = normComparable(last?.time)
  const newTask = normComparable(parseResult?.taskText)
  const newSchedule = normComparable(parseResult?.scheduleText)
  if (!lastTask || !newTask || !lastSchedule || !newSchedule) return false
  return lastTask === newTask && lastSchedule === newSchedule
}

function extractDayFromText(text) {
  const m = String(text || '').match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i)
  const n = m ? Number(m[1]) : null
  return n >= 1 && n <= 31 ? n : null
}

function hasExplicitEditSignal(text) {
  return EDIT_SIGNAL.test(String(text || '').trim())
}

function isFollowUpUpdatePhrase(text) {
  return hasExplicitEditSignal(text)
}

function scrubCorrectionEntities(entities) {
  const out = { ...(entities || {}) }
  if (isCorrectionEntityName(out.serviceName)) delete out.serviceName
  if (isCorrectionEntityName(out.actionText)) delete out.actionText
  return out
}

function looksLikeNewReminderCreate(text, parseResult) {
  const pf = parseResult || parseFirst(text)
  const task = normComparable(pf.taskText)
  const schedule = normComparable(pf.scheduleText)
  if (task.length < 4 || schedule.length < 4) return false
  if (task === schedule || task.endsWith(schedule) || schedule.endsWith(task)) return false
  if (/^(actually|tomorrow|friday|nextweek|yes|ok|no)$/.test(task)) return false
  return true
}
function buildClarifyUpdateText(last) {
  const title = last?.title || 'Task'
  const schedule = last?.time || ''
  return `I already have:\n\n${title}\n${schedule}\n\nUpdate it?\n(yes/no)`
}

function isAmbiguousUpdateCandidate(text, intent, dateEntity) {
  if (!dateEntity || hasExplicitEditSignal(text) || /\bremind\s+me\b/i.test(text)) return false
  const passthrough = new Set([
    INTENTS.REMINDER_CANCEL,
    INTENTS.DELETE_ENTITY,
    INTENTS.SUBSCRIPTION_DELETE,
    INTENTS.REMINDER_QUERY,
    INTENTS.SUBSCRIPTION_QUERY,
    INTENTS.HELP,
    INTENTS.CONFIRM,
    INTENTS.CANCEL,
    INTENTS.LIST_MORE
  ])
  return !passthrough.has(intent.intent)
}

async function coerceIntentForLastEntity(sender, intent, text) {
  const last = await getLastEntity(sender)
  const pf = last ? parseFirst(text) : null
  const duplicate = last && pf ? isSameReminderSignature(last, pf) : false

  if (isCoercePassthroughIntent(intent, text) && !duplicate && looksLikeNewReminderCreate(text, pf)) {
    return intent
  }

  if (!last) return intent

  const det = detectIntent(text)
  const dateEntity = intent.entities?.date || det.entities?.date

  if (last.type === 'reminder' && dateEntity) {
    const parsed = pf || parseFirst(text)
    const isDuplicate = isSameReminderSignature(last, parsed)

    if (
      (intent.intent === INTENTS.REMINDER_CREATE || isCoercePassthroughIntent(intent, text)) &&
      !isDuplicate &&
      looksLikeNewReminderCreate(text, parsed)
    ) {
      return intent
    }

    if (hasExplicitEditSignal(text)) {
      return {
        ...intent,
        intent: INTENTS.REMINDER_RESCHEDULE,
        entities: scrubCorrectionEntities({ ...det.entities, ...intent.entities, date: dateEntity }),
        confidence: Math.max(Number(intent.confidence) || 0, 0.9),
        lastEntityId: last.id,
        ai_intent: 'UPDATE_REMINDER',
        execution_intent: INTENTS.REMINDER_RESCHEDULE
      }
    }
    if (isDuplicate && isAmbiguousUpdateCandidate(text, intent, dateEntity)) {
      return {
        ...intent,
        intent: CLARIFY_UPDATE,
        clarificationText: buildClarifyUpdateText(last),
        entities: scrubCorrectionEntities({ ...det.entities, ...intent.entities, date: dateEntity }),
        lastEntityId: last.id,
        pending_intent: INTENTS.REMINDER_RESCHEDULE,
        execution_intent: INTENTS.REMINDER_RESCHEDULE
      }
    }
    if (
      !isDuplicate &&
      isAmbiguousUpdateCandidate(text, intent, dateEntity) &&
      !looksLikeNewReminderCreate(text, parsed)
    ) {
      return {
        ...intent,
        intent: CLARIFY_UPDATE,
        clarificationText: buildClarifyUpdateText(last),
        entities: scrubCorrectionEntities({ ...det.entities, ...intent.entities, date: dateEntity }),
        lastEntityId: last.id,
        pending_intent: INTENTS.REMINDER_RESCHEDULE,
        execution_intent: INTENTS.REMINDER_RESCHEDULE
      }
    }
  }

  if (last.type === 'subscription') {
    const day =
      intent.entities?.renewalDay ||
      extractDayFromText(text) ||
      (intent.entities?.date?.day ? Number(intent.entities.date.day) : null)
    if (
      day &&
      (hasExplicitEditSignal(text) || intent.intent === INTENTS.SUBSCRIPTION_UPDATE)
    ) {
      return {
        ...intent,
        intent: INTENTS.SUBSCRIPTION_UPDATE,
        entities: { ...intent.entities, renewalDay: day },
        confidence: 0.9,
        lastEntityId: last.id
      }
    }
  }

  return intent
}

module.exports = {
  coerceIntentForLastEntity,
  extractDayFromText,
  isFollowUpUpdatePhrase,
  hasExplicitEditSignal,
  isSameReminderSignature,
  CLARIFY_UPDATE,
  buildClarifyUpdateText
}
