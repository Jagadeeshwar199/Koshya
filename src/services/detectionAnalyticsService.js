/** In-process detection analytics — EXTENSION: persist to Supabase metrics table. */
const stats = {
  execution_count: 0,
  clarification_count: 0,
  ai_fallback_count: 0,
  failed_messages: []
}

function recordExecution() {
  stats.execution_count++
}

function recordClarification(message) {
  stats.clarification_count++
  pushFailed(message)
}

function recordAiFallback(message) {
  stats.ai_fallback_count++
  pushFailed(message)
}

function pushFailed(message) {
  if (!message) return
  stats.failed_messages.unshift(String(message).slice(0, 120))
  if (stats.failed_messages.length > 50) stats.failed_messages.length = 50
}

function getAnalytics() {
  const top = {}
  for (const m of stats.failed_messages) top[m] = (top[m] || 0) + 1
  const top_failed_messages = Object.entries(top)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }))
  return { ...stats, top_failed_messages }
}

function resetAnalytics() {
  stats.execution_count = 0
  stats.clarification_count = 0
  stats.ai_fallback_count = 0
  stats.failed_messages = []
}

module.exports = {
  recordExecution,
  recordClarification,
  recordAiFallback,
  getAnalytics,
  resetAnalytics
}
