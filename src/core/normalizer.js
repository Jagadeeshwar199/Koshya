/**
 * Single normalizer — all reminders/events pass through normalizeEvent().
 */
const { extractTriggerTime } = require('./parser')

function normalizeEvent(parseResult) {
  const trigger_time = extractTriggerTime(parseResult?.entities)
  return {
    message: parseResult?.normalized || String(parseResult?.rawMessage || '').trim(),
    event_name: parseResult?.event_name || 'Task',
    trigger_time,
    recurrence: parseResult?.scheduleText || parseResult?.entities?.recurrence || null,
    confidence: Number(parseResult?.confidence || 0)
  }
}

module.exports = { normalizeEvent }
