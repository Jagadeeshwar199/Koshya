const MAX_SUBSCRIPTION_AMOUNT = Number(process.env.MAX_SUBSCRIPTION_AMOUNT || 1000000)
const MAX_TASK_LENGTH = 200

function sanitizeTaskText(text) {
  return String(text || '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[`;]/g, '')
    .trim()
    .slice(0, MAX_TASK_LENGTH)
}

function isValidAmount(amount) {
  const n = Number(amount)
  return Number.isFinite(n) && n > 0 && n <= MAX_SUBSCRIPTION_AMOUNT
}

function isValidTimeEntity(time) {
  if (!time || typeof time !== 'object') return true
  const hour = Number(time.hour)
  const minute = Number(time.minute || 0)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function isValidMeridiemHour(hour) {
  const h = Number(hour)
  return Number.isInteger(h) && h >= 1 && h <= 12
}

module.exports = {
  MAX_SUBSCRIPTION_AMOUNT,
  sanitizeTaskText,
  isValidAmount,
  isValidTimeEntity,
  isValidMeridiemHour
}
