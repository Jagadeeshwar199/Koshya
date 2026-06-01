const supabase = require('../../config/supabase')
const { parseSubscriptionMessage } = require('./parserService')
const { matchSubscriptionsByService } = require('../utils/serviceMatcher')
const { ApiError } = require('../utils/apiError')

const ALLOWED_UPDATE_FIELDS = [
  'serviceName',
  'amount',
  'renewalDay',
  'renewalMonth',
  'recurrence'
]

function formatSupabaseError(error) {
  if (!error) {
    return null
  }

  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
  }
}

function normalizePhone(phone) {
  if (typeof phone !== 'string') {
    throw new ApiError(400, 'userPhone must be a string')
  }

  const trimmed = phone.trim()

  if (!/^\+?\d{8,15}$/.test(trimmed)) {
    throw new ApiError(400, 'userPhone must contain 8 to 15 digits')
  }

  return trimmed.replace(/^\+/, '')
}

function validateId(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ApiError(400, 'id is required')
  }

  return id.trim()
}

function validateServiceName(serviceName) {
  if (typeof serviceName !== 'string' || !serviceName.trim()) {
    throw new ApiError(400, 'serviceName must be a non-empty string')
  }

  return serviceName.trim()
}

function validateAmount(amount) {
  const parsed = Number(amount)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, 'amount must be a positive number')
  }

  return parsed
}

function validateRenewalDay(renewalDay) {
  if (renewalDay === null) {
    return null
  }

  const parsed = Number(renewalDay)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    throw new ApiError(400, 'renewalDay must be an integer between 1 and 31')
  }

  return parsed
}

function validateRenewalMonth(renewalMonth) {
  if (renewalMonth === null || renewalMonth === undefined || renewalMonth === '') {
    return null
  }

  if (typeof renewalMonth !== 'string') {
    throw new ApiError(400, 'renewalMonth must be a string')
  }

  return renewalMonth.trim()
}

function validateRecurrence(recurrence) {
  if (typeof recurrence !== 'string' || !recurrence.trim()) {
    throw new ApiError(400, 'recurrence must be a non-empty string')
  }

  const normalized = recurrence.toLowerCase().trim()

  if (
    normalized !== 'monthly' &&
    normalized !== 'yearly' &&
    !/^\d+\s+months?$/.test(normalized)
  ) {
    throw new ApiError(
      400,
      'recurrence must be monthly, yearly, or every N months'
    )
  }

  return normalized
}

function subscriptionToRow(subscription) {
  return {
    user_phone: normalizePhone(subscription.userPhone),
    service_name: validateServiceName(subscription.serviceName),
    amount: validateAmount(subscription.amount),
    renewal_day:
      subscription.renewalDay === undefined
        ? null
        : validateRenewalDay(subscription.renewalDay),
    renewal_month: validateRenewalMonth(subscription.renewalMonth),
    recurrence: validateRecurrence(subscription.recurrence)
  }
}

function updateToRow(updates) {
  const payload = {}

  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (!(field in updates)) {
      continue
    }

    if (field === 'serviceName') {
      payload.service_name = validateServiceName(updates[field])
    }
    if (field === 'amount') {
      payload.amount = validateAmount(updates[field])
    }
    if (field === 'renewalDay') {
      payload.renewal_day = validateRenewalDay(updates[field])
    }
    if (field === 'renewalMonth') {
      payload.renewal_month = validateRenewalMonth(updates[field])
    }
    if (field === 'recurrence') {
      payload.recurrence = validateRecurrence(updates[field])
    }
  }

  if (!Object.keys(payload).length) {
    throw new ApiError(
      400,
      `At least one update field is required: ${ALLOWED_UPDATE_FIELDS.join(', ')}`
    )
  }

  return payload
}

function mapSubscriptionRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    userPhone: row.user_phone,
    serviceName: row.service_name,
    amount: row.amount,
    renewalDay: row.renewal_day,
    renewalMonth: row.renewal_month,
    recurrence: row.recurrence,
    active: row.active,
    reminderDaysBefore: row.reminder_days_before,
    lastRemindedAt: row.last_reminded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function assertCompleteParsedSubscription(parsed) {
  if (parsed?.type === 'subscription' && parsed.success) {
    return parsed
  }

  throw new ApiError(
    422,
    'message does not contain a complete subscription',
    parsed
  )
}

async function createSubscriptionFromMessage({ userPhone, message }) {
  const parsed = await parseSubscriptionMessage(message)
  await assertCompleteParsedSubscription(parsed)

  const row = subscriptionToRow({
    userPhone,
    serviceName: parsed.serviceName,
    amount: parsed.amount,
    renewalDay: parsed.renewalDay,
    renewalMonth: parsed.renewalMonth,
    recurrence: parsed.recurrence
  })

  const { data, error } = await supabase
    .from('subscriptions')
    .insert(row)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to create subscription', formatSupabaseError(error))
  }

  return {
    subscription: mapSubscriptionRow(data),
    parsed
  }
}

async function getUserSubscriptions(phone) {
  const userPhone = normalizePhone(phone)

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_phone', userPhone)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(502, 'failed to fetch subscriptions', formatSupabaseError(error))
  }

  return (data || []).map(mapSubscriptionRow)
}

async function getSubscriptionById(id) {
  const subscriptionId = validateId(id)

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to fetch subscription', formatSupabaseError(error))
  }

  if (!data) {
    throw new ApiError(404, 'subscription not found')
  }

  return mapSubscriptionRow(data)
}

async function updateSubscription(id, updates) {
  const subscriptionId = validateId(id)
  const payload = updateToRow(updates || {})

  const { data, error } = await supabase
    .from('subscriptions')
    .update(payload)
    .eq('id', subscriptionId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to update subscription', formatSupabaseError(error))
  }

  if (!data) {
    throw new ApiError(404, 'subscription not found')
  }

  return mapSubscriptionRow(data)
}

async function deleteSubscription(id) {
  const subscriptionId = validateId(id)

  const { data, error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to delete subscription', formatSupabaseError(error))
  }

  if (!data) {
    throw new ApiError(404, 'subscription not found')
  }

  return mapSubscriptionRow(data)
}

function countDistinctSubscriptionSignatures(subscriptions) {
  const signatures = new Set(
    subscriptions.map((subscription) =>
      [
        subscription.serviceName.toLowerCase(),
        subscription.amount,
        subscription.renewalDay,
        subscription.renewalMonth || '',
        subscription.recurrence
      ].join('|')
    )
  )

  return signatures.size
}

async function archiveSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(502, 'failed to remove subscription', formatSupabaseError(error))
  }

  const { error: reminderError } = await supabase
    .from('reminders')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', id)
    .eq('status', 'pending')

  if (reminderError) {
    throw new ApiError(502, 'failed to remove subscription reminders', formatSupabaseError(reminderError))
  }

  return mapSubscriptionRow(data)
}

async function archiveSubscriptionFromIntent({ userPhone, serviceName }) {
  if (!serviceName) {
    return { status: 'needs_service_name', subscriptions: [] }
  }

  const subscriptions = await getUserSubscriptions(userPhone)
  const matches = matchSubscriptionsByService(subscriptions, serviceName)

  if (!matches.length) {
    return { status: 'not_found', subscriptions: [] }
  }

  if (countDistinctSubscriptionSignatures(matches) > 1) {
    return { status: 'multiple', subscriptions: matches }
  }

  const subscription = await archiveSubscription(matches[0].id)
  return { status: 'removed', subscription }
}

module.exports = {
  createSubscriptionFromMessage,
  getUserSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  archiveSubscriptionFromIntent,
  mapSubscriptionRow,
  normalizePhone,
  validateId,
  validateRecurrence,
  formatSupabaseError
}
