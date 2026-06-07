const { normalizeText, applyTypoFixes } = require('../utils/textUtils')
const { extractEntities, titleCase } = require('../intent/entityExtractor')
const { parseMessage } = require('./parserCore')
const { detectIntent, INTENTS } = require('./intentService')
const { formatScheduleShort } = require('../formatters/subscriptionFormatter')

const SUBSCRIPTION_HINT =
  /\b(?:netflix|spotify|prime|hotstar|disney|renew|subscription|renews?\s+on)\b/i
const BILL_HINT = /\b(?:rent|emi|bill|pay\s|payment)\b/i

function ordinal(day) {
  const n = Number(day)
  if (!Number.isInteger(n)) return String(day)
  const mod = n % 100
  const suffix =
    mod >= 11 && mod <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]
  return `${n}${suffix}`
}

function formatTime(time) {
  if (!time) return ''
  let hour = Number(time.hour)
  const minute = Number(time.minute || 0)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  if (minute) return `${hour}:${String(minute).padStart(2, '0')} ${ampm}`
  return `${hour} ${ampm}`
}

function parseClock(text) {
  const m = String(text || '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  let hour = Number(m[1])
  const minute = Number(m[2] || 0)
  const mer = m[3]?.toLowerCase()
  if (mer === 'pm' && hour < 12) hour += 12
  if (mer === 'am' && hour === 12) hour = 0
  if (!mer && hour <= 12 && /\bpm\b/i.test(String(text))) hour = hour === 12 ? 12 : hour + 12
  return { hour, minute }
}

function extractScheduleText(text, entities, parsed) {
  const lower = String(text || '').toLowerCase()
  const weekday = lower.match(
    /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i
  )
  if (weekday) {
    const day = titleCase(weekday[1])
    const clock = weekday[2] ? parseClock(weekday[2]) : entities.date?.time
    const time = clock ? formatTime(clock) : ''
    return time ? `Every ${day} · ${time}` : `Every ${day}`
  }
  if (/\bdaily\b|\bevery\s+day\b/i.test(lower)) {
    const clock = entities.date?.time || parseClock(text)
    return clock ? `Every day · ${formatTime(clock)}` : 'Every day'
  }
  const dayNum = parsed?.draft?.renewalDay || entities.date?.day
  if ((parsed?.draft?.recurrence === 'monthly' || entities.recurrence === 'monthly' || /\bevery\s+month\b/i.test(lower)) && dayNum) {
    return `Every month on ${ordinal(dayNum)}`
  }
  if (parsed?.draft?.serviceName && (parsed?.draft?.recurrence || parsed?.draft?.renewalDay)) {
    return formatScheduleShort(parsed.draft)
  }
  if (entities.date?.kind === 'relative' && entities.date.value === 'tomorrow') {
    return entities.date.time ? `Tomorrow · ${formatTime(entities.date.time)}` : 'Tomorrow'
  }
  if (entities.date?.kind === 'offset') {
    return `In ${entities.date.minutes} minutes`
  }
  if (entities.date?.time) return formatTime(entities.date.time)
  return ''
}

function stripSchedule(text) {
  return String(text || '')
    .replace(/\bremind\s+(?:me\s+)?(?:to\s+)?/gi, '')
    .replace(/\b(?:renews?\s+on|every\s+month|monthly|yearly)\b[^.]*$/gi, '')
    .replace(/\bevery\s+(?:day|month|year|\d+\s+months?|[a-z]+day)\b(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/gi, '')
    .replace(/\b(?:tomorrow|today|tonight|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTaskText(text, entities, parsed, itemType) {
  if (itemType === 'SUBSCRIPTION') {
    return parsed?.draft?.serviceName || entities.serviceName || 'Subscription'
  }
  if (entities.actionText) return titleCase(entities.actionText)
  const stripped = stripSchedule(text)
  if (stripped.length > 2) return titleCase(stripped)
  if (parsed?.draft?.serviceName) return titleCase(parsed.draft.serviceName)
  if (entities.serviceName) return titleCase(entities.serviceName)
  return 'Task'
}

function classifyItemType(text, entities, parsed) {
  const lower = String(text || '').toLowerCase()
  if (SUBSCRIPTION_HINT.test(lower) || (parsed?.draft?.serviceName && parsed?.draft?.recurrence)) {
    return 'SUBSCRIPTION'
  }
  if (BILL_HINT.test(lower) && (entities.recurrence || /\b(?:every|monthly|\d{1,2}(?:st|nd|rd|th))\b/i.test(lower))) {
    return 'BILL'
  }
  if (entities.recurrence || /\bevery\s+/i.test(lower) || entities.date) return 'REMINDER'
  return 'EVENT'
}

function parseFirst(rawMessage, ai = null) {
  const normalized = normalizeText(applyTypoFixes(rawMessage))
  const entities = extractEntities(normalized)
  const parsed = parseMessage(normalized)
  const rule = detectIntent(normalized)
  const ruleScore = Math.round(Number(rule.confidence || 0) * 100)
  const itemType = classifyItemType(normalized, entities, parsed)
  let taskText = extractTaskText(normalized, entities, parsed, itemType)
  let scheduleText = extractScheduleText(normalized, entities, parsed)

  let aiIntent = null
  let aiConfidence = null
  let finalIntent = rule.intent
  let escalatedToAi = ruleScore < 90

  if (ai?.success && ai.ai_intent && ai.ai_intent !== INTENTS.UNKNOWN) {
    aiIntent = ai.ai_intent
    aiConfidence = Math.round(Number(ai.confidence || 0) * 100)
    finalIntent = ai.ai_intent
    escalatedToAi = true
    if (ai.entities?.actionText) taskText = titleCase(ai.entities.actionText)
    if (ai.entities?.serviceName && itemType === 'SUBSCRIPTION') taskText = ai.entities.serviceName
    if (ai.task) taskText = ai.task
    if (ai.schedule) scheduleText = ai.schedule
    if (ai.item_type) itemType = ai.item_type
  } else if (ruleScore >= 90 && rule.intent !== INTENTS.UNKNOWN) {
    finalIntent = rule.intent
    escalatedToAi = false
  }

  return {
    normalized,
    taskText,
    scheduleText,
    itemType,
    entities,
    parsed,
    ruleIntent: rule.intent,
    ruleScore,
    aiIntent,
    aiConfidence,
    finalIntent,
    escalatedToAi
  }
}

function parseMetaRow(meta) {
  if (!meta) return {}
  return {
    task_text: meta.taskText || null,
    schedule_text: meta.scheduleText || null,
    item_type: meta.itemType || null,
    rule_intent: meta.ruleIntent || null,
    rule_score: meta.ruleScore ?? null,
    ai_intent: meta.aiIntent || null,
    ai_confidence: meta.aiConfidence ?? null,
    final_intent: meta.finalIntent || null,
    escalated_to_ai: meta.escalatedToAi === true
  }
}

module.exports = { parseFirst, parseMetaRow, classifyItemType, extractTaskText, extractScheduleText }
