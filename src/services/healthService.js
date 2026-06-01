const supabase = require('../../config/supabase')

async function checkDatabaseHealth() {
  const { error } = await supabase.from('messages').select('id').limit(1)

  if (error) {
    return {
      ok: false,
      error: error.message
    }
  }

  return { ok: true }
}

module.exports = {
  checkDatabaseHealth
}
