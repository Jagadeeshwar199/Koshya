const supabase =
  require('../config/supabase')

function pickFirst(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ''
  )
}

function normalizeRecurrence(recurrence) {
  if (!recurrence) {
    return recurrence
  }

  const lower = String(recurrence).toLowerCase().trim()

  if (lower === 'monthly' || lower === 'yearly') {
    return lower
  }

  const monthsMatch = lower.match(/^(\d+)\s+months?$/)

  if (monthsMatch) {
    const months = Number(monthsMatch[1])

    if (months === 3) {
      return 'yearly'
    }

    if (months >= 6) {
      return 'yearly'
    }

    return 'monthly'
  }

  return lower
}

function getParsedOutput(input) {
  return (
    input.parsed ||
    input.parseResult ||
    input.parseOutput ||
    input.subscription ||
    input
  )
}

function buildSubscriptionRecord(input) {
  const parsed =
    getParsedOutput(input)

  const userPhone =
    pickFirst(
      input.userPhone,
      input.user_phone,
      input.phone,
      input.sender,
      parsed.userPhone,
      parsed.user_phone,
      parsed.phone,
      parsed.sender
    )

  const serviceName =
    pickFirst(
      parsed.serviceName,
      parsed.service_name,
      input.serviceName,
      input.service_name
    )

  const amount =
    Number(
      pickFirst(
        parsed.amount,
        input.amount
      )
    )

  const renewalDay =
    Number(
      pickFirst(
        parsed.renewalDay,
        parsed.renewal_day,
        input.renewalDay,
        input.renewal_day
      )
    )

  const recurrence =
    pickFirst(
      parsed.recurrence,
      input.recurrence
    )

  const renewalMonth =
    pickFirst(
      parsed.renewalMonth,
      parsed.renewal_month,
      input.renewalMonth,
      input.renewal_month
    )

  const errors = []

  if (
    parsed.success === false ||
    (
      parsed.type &&
      parsed.type !== 'subscription'
    )
  ) {
    errors.push(
      'parsed output must be a successful subscription'
    )
  }

  if (!userPhone) {
    errors.push('userPhone is required')
  }

  if (!serviceName) {
    errors.push('serviceName is required')
  }

  if (!Number.isFinite(amount)) {
    errors.push('amount is required')
  }

  if (!Number.isFinite(renewalDay)) {
    errors.push('renewalDay is required')
  }

  if (!recurrence) {
    errors.push('recurrence is required')
  }

  if (errors.length) {
    return {
      errors
    }
  }

  return {
    record: {
      user_phone:
        userPhone,

      service_name:
        serviceName,

      amount:
        amount,

      renewal_day:
        renewalDay,

      renewal_month:
        renewalMonth === undefined
          ? null
          : renewalMonth,

      recurrence:
        normalizeRecurrence(recurrence)
    }
  }
}

async function createSubscription(input = {}) {

  try {

    const {
      record,
      errors
    } = buildSubscriptionRecord(input)

    if (errors) {
      return {
        success: false,
        status: 400,
        error: {
          message:
            'Invalid subscription payload',
          details:
            errors
        }
      }
    }

    const {
      error
    } = await supabase

      .from('subscriptions')

      .insert([{

        user_phone:
          record.user_phone,

        service_name:
          record.service_name,

        amount:
          record.amount,

        renewal_day:
          record.renewal_day,

        renewal_month:
          record.renewal_month,

        recurrence:
          record.recurrence
      }])

    if (error) {

      return {
        success: false,
        error
      }
    }

    return {
      success: true,
      subscription:
        record
    }

  } catch (err) {

    return {
      success: false,
      error: err
    }
  }
}

module.exports = {
  createSubscription,
  buildSubscriptionRecord
}
