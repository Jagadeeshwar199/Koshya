const supabase = require('../../config/supabase')
const logger = require('../../utils/logger')
const { normalizeText, normalizeForIntentMatch, applyTypoFixes } = require('../utils/textUtils')
const {
  detectIntent,
  detectClauseIntents,
  INTENTS,
  MIN_CONFIDENCE
} = require('./intentService')
const intentDetector = require('../intent/intentDetector')
const { extractEntities } = require('../intent/entityExtractor')
const { sendWhatsAppMessage, setOutboundCapture, clearOutboundCapture } = require('./whatsappService')

const THRESHOLD_PCT = Math.round(MIN_CONFIDENCE * 100)

function intentSlug(name) {
  return String(name || '').toLowerCase()
}

function formatDateEntity(date) {
  if (!date) return null
  if (date.kind === 'relative') return [date.value, date.period].filter(Boolean).join(' ')
  if (date.kind === 'offset') return `in ${date.minutes || date.hours || date.days} ${date.minutes ? 'mins' : date.hours ? 'hours' : 'days'}`
  if (date.time) {
    const h = date.time.hour
    const m = date.time.minute || 0
    const ap = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`
  }
  if (date.day) return `${date.day}${date.month ? ` ${date.month}` : ''}`
  return date.kind || null
}

function formatEntities(entities = {}) {
  const out = {}
  if (entities.serviceName) out.service = entities.serviceName
  const dt = formatDateEntity(entities.date)
  if (dt) out.datetime = dt
  if (entities.recurrence) out.recurrence = entities.recurrence
  if (entities.amount) out.amount = entities.amount
  if (entities.actionText) out.action = entities.actionText
  if (entities.queryType) out.queryType = entities.queryType
  if (entities.clarify) out.clarify = entities.clarify
  return out
}

function scoreSnapshot(text) {
  const normalized = normalizeText(applyTypoFixes(text))
  const lower = normalizeForIntentMatch(normalized)
  const entities = extractEntities(normalized)
  const scores = intentDetector.scoreSignals(
    normalized,
    lower,
    entities,
    require('../intent/semanticDictionaries').DEFAULT_FUZZY_THRESHOLD
  )
  const out = {}
  for (const [intent, score] of Object.entries(scores)) {
    if (score > 0.05) out[intentSlug(intent)] = Math.round(score * 100)
  }
  return { normalized, entities, scores: out }
}

function routeName(intentName, entities = {}) {
  const map = {
    [INTENTS.SUBSCRIPTION_CREATE]: 'subscription_create',
    [INTENTS.SUBSCRIPTION_UPDATE]: 'subscription_update',
    [INTENTS.SUBSCRIPTION_DELETE]: 'subscription_delete',
    [INTENTS.SUBSCRIPTION_EXPIRY]: 'subscription_expiry',
    [INTENTS.SUBSCRIPTION_QUERY]: entities.queryType === 'expiry' ? 'show_expiring_subscriptions' : 'show_subscriptions',
    [INTENTS.REMINDER_CREATE]: 'reminder_create',
    [INTENTS.REMINDER_UPDATE]: 'reminder_update',
    [INTENTS.REMINDER_RESCHEDULE]: 'reminder_reschedule',
    [INTENTS.REMINDER_CANCEL]: 'reminder_delete',
    [INTENTS.REMINDER_QUERY]: 'show_reminders',
    [INTENTS.DELETE_ENTITY]: 'delete_entity',
    [INTENTS.HELP]: 'help',
    [INTENTS.UNKNOWN]: 'unknown',
    MULTI: 'multi_intent'
  }
  return map[intentName] || intentSlug(intentName)
}

function actionName(route) {
  if (!route) return null
  if (route.startsWith('show_')) return 'query'
  if (route === 'unknown' || route === 'clarify') return 'clarify'
  if (route === 'multi_intent') return 'multi'
  if (route.includes('delete') || route.includes('cancel')) return 'delete'
  if (route.includes('update') || route.includes('reschedule')) return 'update'
  if (route.includes('create') || route === 'subscription_expiry' || route === 'reminder_create') return 'create'
  return 'handle'
}

function assessOutcome({ clauses, primaryIntent, selectedRoute, result, responses }) {
  const body = responses.join('\n')
  if (result?.error) {
    return { success: false, failure_reason: 'handler_error' }
  }
  if (clauses.length > 1 && result?.intent === 'MULTI' && result?.clauses !== clauses.length) {
    return { success: false, failure_reason: 'multi_intent_partial' }
  }
  if (primaryIntent === INTENTS.SUBSCRIPTION_EXPIRY && /Expiring soon/i.test(body)) {
    return { success: false, failure_reason: `wrong_route:${intentSlug(primaryIntent)}->show_expiring_subscriptions` }
  }
  if (primaryIntent === INTENTS.REMINDER_CREATE && /Show today|Show reminders/i.test(body)) {
    return { success: false, failure_reason: `wrong_route:${intentSlug(primaryIntent)}->show_reminders` }
  }
  if (primaryIntent === INTENTS.SUBSCRIPTION_EXPIRY && selectedRoute === 'show_expiring_subscriptions') {
    return { success: false, failure_reason: `wrong_route:${intentSlug(primaryIntent)}->show_expiring_subscriptions` }
  }
  if (entitiesClarify(clauses)) {
    return { success: true, failure_reason: null }
  }
  if (primaryIntent === INTENTS.UNKNOWN) {
    return { success: false, failure_reason: 'low_confidence' }
  }
  if (result?.ok === false) {
    return { success: false, failure_reason: 'handler_error' }
  }
  return { success: true, failure_reason: null }
}

function entitiesClarify(clauses) {
  return clauses.some((c) => c.entities?.clarify === 'short')
}

function buildSnapshot(rawMessage, clauses) {
  const primary = clauses[0] || detectIntent(rawMessage)
  const { normalized, scores } = scoreSnapshot(rawMessage)
  return {
    raw_message: rawMessage,
    normalized_message: normalized,
    detected_intents: clauses.map((c) => intentSlug(c.intent)),
    confidence_scores: scores,
    extracted_entities: formatEntities(primary.entities),
    primaryIntent: primary.intent,
    clauses
  }
}

async function trackParserEvent(payload) {
  const row = {
    user_id: payload.user_id,
    raw_message: payload.raw_message,
    normalized_message: payload.normalized_message,
    detected_intents: payload.detected_intents,
    confidence_scores: payload.confidence_scores,
    extracted_entities: payload.extracted_entities,
    selected_route: payload.selected_route || null,
    action_taken: payload.action_taken || null,
    success: payload.success !== false,
    failure_reason: payload.failure_reason || null,
    response_sent: payload.response_sent || null
  }

  const { error } = await supabase.from('parser_events').insert(row)
  if (error) {
    logger.error('parser_telemetry.insert_failed', { error: error.message, userId: payload.user_id })
  }
  return row
}

function isAdminPhone(userId) {
  const admins = String(process.env.ADMIN_PHONES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return admins.length > 0 && admins.includes(String(userId))
}

function parseAdminCommand(text) {
  const cmd = String(text || '').trim().toLowerCase()
  if (cmd === 'parser stats') return 'stats'
  if (cmd === 'parser failures') return 'failures'
  if (cmd === 'parser routes') return 'routes'
  if (cmd === 'parser low-confidence' || cmd === 'parser low confidence') return 'low_confidence'
  return null
}

async function queryRows(fn) {
  const { data, error } = await fn()
  if (error) throw error
  return data || []
}

function formatLines(title, rows, formatter) {
  if (!rows.length) return `${title}\n(none)`
  return `${title}\n${rows.map(formatter).join('\n')}`
}

async function adminStatsReply() {
  const events = await queryRows(() => supabase.from('parser_events').select('success'))
  const total = events.length
  const failed = events.filter((e) => !e.success).length
  const topFailures = await queryRows(() =>
    supabase.from('parser_events').select('failure_reason').eq('success', false).not('failure_reason', 'is', null)
  )
  const failCounts = {}
  for (const row of topFailures) {
    const key = row.failure_reason.split('->')[0]
    failCounts[key] = (failCounts[key] || 0) + 1
  }
  const topFailedMsgs = await queryRows(() =>
    supabase.from('parser_events').select('raw_message').eq('success', false).limit(500)
  )
  const msgCounts = {}
  for (const row of topFailedMsgs) msgCounts[row.raw_message] = (msgCounts[row.raw_message] || 0) + 1
  const topServices = await queryRows(() =>
    supabase.from('parser_events').select('extracted_entities').in('selected_route', ['unknown', 'clarify']).limit(500)
  )
  const svcCounts = {}
  for (const row of topServices) {
    const s = row.extracted_entities?.service
    if (s) svcCounts[s] = (svcCounts[s] || 0) + 1
  }

  const rate = total ? Math.round(((total - failed) / total) * 100) : 0
  return [
    `📊 Parser Stats`,
    `Total: ${total}`,
    `Success: ${rate}%`,
    `Failure: ${total ? 100 - rate : 0}%`,
    '',
    formatLines('Top Failures', Object.entries(failCounts).sort((a, b) => b[1] - a[1]).slice(0, 5), ([k, v]) => `• ${k}: ${v}`),
    '',
    formatLines('Top Failed Inputs', Object.entries(msgCounts).sort((a, b) => b[1] - a[1]).slice(0, 5), ([k, v]) => `• ${k} (${v})`),
    '',
    formatLines('Top Unknown Services', Object.entries(svcCounts).sort((a, b) => b[1] - a[1]).slice(0, 5), ([k, v]) => `• ${k}: ${v}`)
  ].join('\n')
}

async function adminFailuresReply() {
  const rows = await queryRows(() =>
    supabase
      .from('parser_events')
      .select('created_at, raw_message, failure_reason, selected_route')
      .eq('success', false)
      .order('created_at', { ascending: false })
      .limit(50)
  )
  return formatLines(
    '🚨 Last 50 Failures',
    rows,
    (r) => `• ${r.raw_message.slice(0, 60)}\n  ${r.failure_reason || 'unknown'} (${r.selected_route || '-'})`
  )
}

async function adminRoutesReply() {
  const rows = await queryRows(() => supabase.from('parser_events').select('selected_route').limit(5000))
  const counts = {}
  for (const row of rows) counts[row.selected_route || 'null'] = (counts[row.selected_route || 'null'] || 0) + 1
  return formatLines(
    '🛣 Route Distribution',
    Object.entries(counts).sort((a, b) => b[1] - a[1]),
    ([k, v]) => `• ${k}: ${v}`
  )
}

async function adminLowConfidenceReply() {
  const rows = await queryRows(() =>
    supabase.from('parser_events').select('normalized_message, confidence_scores').limit(5000)
  )
  const counts = {}
  for (const row of rows) {
    const max = Math.max(...Object.values(row.confidence_scores || {}).map(Number), 0)
    if (max >= THRESHOLD_PCT) continue
    const key = row.normalized_message
    counts[key] = (counts[key] || 0) + 1
  }
  return formatLines(
    `🌫 Low Confidence (<${THRESHOLD_PCT}%)`,
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20),
    ([k, v]) => `• ${k} (${v})`
  )
}

async function handleParserAdminCommand(sender, command) {
  const handlers = {
    stats: adminStatsReply,
    failures: adminFailuresReply,
    routes: adminRoutesReply,
    low_confidence: adminLowConfidenceReply
  }
  const body = await handlers[command]()
  await sendWhatsAppMessage(sender, body)
  return { ok: true, intent: 'ADMIN', adminCommand: command }
}

async function logIncomingMessage(userId, rawMessage, routeFn) {
  const responses = []
  if (setOutboundCapture) setOutboundCapture((text) => responses.push(text))
  const clauses = detectClauseIntents(rawMessage)
  const snapshot = buildSnapshot(rawMessage, clauses.length > 1 ? clauses : [detectIntent(rawMessage)])
  let result
  try {
    result = await routeFn()
  } catch (err) {
    result = { ok: false, error: err.message, intent: 'ERROR' }
    throw err
  } finally {
    clearOutboundCapture?.()
    const selectedRoute = routeName(result?.intent || snapshot.primaryIntent, snapshot.clauses[0]?.entities)
    const outcome = assessOutcome({
      clauses: snapshot.clauses,
      primaryIntent: snapshot.primaryIntent,
      selectedRoute,
      result,
      responses
    })
    trackParserEvent({
      user_id: userId,
      raw_message: snapshot.raw_message,
      normalized_message: snapshot.normalized_message,
      detected_intents: snapshot.detected_intents,
      confidence_scores: snapshot.confidence_scores,
      extracted_entities: snapshot.extracted_entities,
      selected_route: selectedRoute,
      action_taken: actionName(selectedRoute),
      response_sent: responses.join('\n') || null,
      ...outcome
    }).catch(() => {})
  }
  return result
}

module.exports = {
  trackParserEvent,
  buildSnapshot,
  assessOutcome,
  routeName,
  actionName,
  isAdminPhone,
  parseAdminCommand,
  handleParserAdminCommand,
  logIncomingMessage,
  THRESHOLD_PCT
}
