const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required'
  )
}

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is required in production'
  )
}

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}

if (typeof WebSocket === 'undefined') {
  clientOptions.realtime = { transport: require('ws') }
}

const supabase = createClient(supabaseUrl, supabaseKey, clientOptions)

module.exports = supabase
