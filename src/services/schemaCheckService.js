const supabase = require('../../config/supabase')

const REQUIRED = {
  reminders: [
    'task_text',
    'schedule_text',
    'item_type',
    'rule_intent',
    'rule_score',
    'ai_intent',
    'ai_confidence',
    'final_intent',
    'escalated_to_ai'
  ],
  subscriptions: [
    'task_text',
    'schedule_text',
    'item_type',
    'rule_intent',
    'rule_score',
    'ai_intent',
    'ai_confidence',
    'final_intent',
    'escalated_to_ai'
  ]
}

async function checkRequiredSchema() {
  const missing = []

  for (const [table, columns] of Object.entries(REQUIRED)) {
    const { error } = await supabase.from(table).select(columns.join(',')).limit(1)
    if (!error) continue
    if (/column .* does not exist|PGRST204/i.test(error.message || '')) {
      missing.push(`${table}: ${columns.join(', ')}`)
      continue
    }
    throw new Error(`schema_check_failed:${table}:${error.message}`)
  }

  if (missing.length) {
    throw new Error(`Missing required schema columns — apply migration 202606071200_parse_first_columns.sql. ${missing.join(' | ')}`)
  }

  return { ok: true }
}

module.exports = { checkRequiredSchema, REQUIRED }
