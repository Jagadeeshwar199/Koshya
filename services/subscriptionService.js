const supabase =
  require('../config/supabase')

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

    return `${months} months`
  }

  return lower
}

async function createSubscription({

  userPhone,
  serviceName,
  amount,
  renewalDay,
  renewalMonth,
  recurrence

}) {

  try {

    const {
      data,
      error
    } = await supabase

      .from('subscriptions')

      .insert([{

        user_phone:
          userPhone,

        service_name:
          serviceName,

        amount:
          amount,

        renewal_day:
          renewalDay,

        renewal_month:
          renewalMonth,

        recurrence:
          normalizeRecurrence(recurrence)
      }])
      .select('*')
      .maybeSingle()

    if (error) {

      return {
        success: false,
        error
      }
    }

    return {
      success: true,
      subscription: data
    }

  } catch (err) {

    return {
      success: false,
      error: err
    }
  }
}

module.exports = {
  createSubscription
}
