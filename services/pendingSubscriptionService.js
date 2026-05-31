const supabase = require('../config/supabase')
const { mergePendingDrafts } = require('./parserService')

const PREFIX = 'PENDING_SUB:'

async function getPending(userPhone) {
  const { data, error } = await supabase
    .from('messages')
    .select('message, created_at')
    .eq('user_phone', userPhone)
    .or(`message.ilike.${PREFIX}%,message.ilike.__PENDING__:%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data?.length) {
    return null
  }

  for (const row of data) {
    const raw = row.message
    let json = null

    if (raw.startsWith(PREFIX)) {
      json = raw.slice(PREFIX.length)
    } else if (raw.startsWith('__PENDING__:')) {
      json = raw.slice('__PENDING__:'.length)
    } else {
      continue
    }

    try {
      const draft = JSON.parse(json)

      if (!draft || draft.cleared) {
        continue
      }

      return draft
    } catch {
      continue
    }
  }

  return null
}

async function setPending(userPhone, draft) {
  const existing = await getPending(userPhone)
  const merged = mergePendingDrafts(existing, draft)

  await supabase.from('messages').insert([
    {
      user_phone: userPhone,
      message: `${PREFIX}${JSON.stringify(merged)}`
    }
  ])
}

async function clearPending(userPhone) {
  await setPending(userPhone, { cleared: true })
}

module.exports = {
  getPending,
  setPending,
  clearPending
}
