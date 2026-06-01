const supabase = require('../../config/supabase')
const { mergePendingDrafts } = require('./parserCore')
const logger = require('../../utils/logger')

async function getPending(userPhone) {
  const { data, error } = await supabase
    .from('pending_drafts')
    .select('draft')
    .eq('user_phone', userPhone)
    .maybeSingle()

  if (error) {
    logger.error('pending_draft.get_failed', { userPhone, error })
    return null
  }

  if (!data?.draft || data.draft.cleared) {
    return null
  }

  return data.draft
}

async function setPending(userPhone, draft) {
  const existing = await getPending(userPhone)
  const merged = mergePendingDrafts(existing, draft)

  const { error } = await supabase.from('pending_drafts').upsert(
    {
      user_phone: userPhone,
      draft: merged,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_phone' }
  )

  if (error) {
    logger.error('pending_draft.set_failed', { userPhone, error })
    throw error
  }
}

async function clearPending(userPhone) {
  const { error } = await supabase
    .from('pending_drafts')
    .delete()
    .eq('user_phone', userPhone)

  if (error) {
    logger.error('pending_draft.clear_failed', { userPhone, error })
    throw error
  }
}

module.exports = {
  getPending,
  setPending,
  clearPending
}
