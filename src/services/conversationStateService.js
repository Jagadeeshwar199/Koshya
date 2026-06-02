const supabase = require('../../config/supabase')
const logger = require('../../utils/logger')

async function getState(userPhone) {
  const { data, error } = await supabase
    .from('conversation_state')
    .select('state')
    .eq('user_phone', userPhone)
    .maybeSingle()

  if (error) {
    logger.error('conversation_state.get_failed', { userPhone, error })
    return null
  }

  return data?.state || null
}

async function setState(userPhone, state) {
  const { error } = await supabase.from('conversation_state').upsert(
    {
      user_phone: userPhone,
      state,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_phone' }
  )

  if (error) {
    logger.error('conversation_state.set_failed', { userPhone, error })
    throw error
  }
}

async function clearState(userPhone) {
  const { error } = await supabase
    .from('conversation_state')
    .delete()
    .eq('user_phone', userPhone)

  if (error) {
    logger.error('conversation_state.clear_failed', { userPhone, error })
    throw error
  }
}

module.exports = {
  getState,
  setState,
  clearState
}
