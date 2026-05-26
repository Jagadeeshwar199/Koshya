const supabase =
  require('../config/supabase')

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
          recurrence
      }])

    if (error) {

      return {
        success: false,
        error
      }
    }

    return {
      success: true
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