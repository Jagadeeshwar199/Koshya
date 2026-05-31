const supabase = require('../config/supabase')

const PREFIX = '__PENDING__:'

async function getPending(userPhone) {
  const { data, error } = await supabase
    .from('messages')
    .select('message')
    .eq('user_phone', userPhone)
    .like('message', `${PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data?.length) {
    return null
  }

  try {
    const draft = JSON.parse(data[0].message.slice(PREFIX.length))
    if (!draft || draft.cleared) {
      return null
    }
    return draft
  } catch {
    return null
  }
}

async function setPending(userPhone, draft) {
  await supabase.from('messages').insert([
    {
      user_phone: userPhone,
      message: `${PREFIX}${JSON.stringify(draft)}`
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
