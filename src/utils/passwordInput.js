function isPasswordCancel(text) {
  return /^cancel$/i.test(String(text || '').trim())
}

function isPlausiblePassword(text) {
  const value = String(text || '').trim()
  if (!value || value.length < 4 || value.length > 64) return false
  if (/[\s\r\n]/.test(value)) return false
  if (!/^\S+$/.test(value)) return false
  return true
}

module.exports = { isPasswordCancel, isPlausiblePassword }
