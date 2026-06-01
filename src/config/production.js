function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GUPSHUP_API_KEY',
    'GUPSHUP_SOURCE_PHONE',
    'WEBHOOK_VERIFY_TOKEN',
    'WEBHOOK_SECRET',
    'API_KEY'
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    )
  }
}

module.exports = {
  validateProductionConfig
}
