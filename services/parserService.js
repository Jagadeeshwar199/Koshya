function parseMessage(text) {

  const monthlyRegex =

    /^(.+?) renews on (\d+)(?:st|nd|rd|th)? every month - (\d+)$/i

  const quarterlyRegex =

    /^(.+?) renews on ([A-Za-z]+) (\d+) every (\d+) months - (\d+)$/i

  const yearlyRegex =

    /^(.+?) renews on ([A-Za-z]+) (\d+) every year - (\d+)$/i

  /*
  ========================================
  MONTHLY
  ========================================
  */

  const monthlyMatch =
    text.match(monthlyRegex)

  if (monthlyMatch) {

    return {

      success: true,

      type: 'subscription',

      serviceName:
        monthlyMatch[1].trim(),

      renewalDay:
        Number(monthlyMatch[2]),

      renewalMonth:
        null,

      recurrence:
        'monthly',

      amount:
        Number(monthlyMatch[3])
    }
  }

  /*
  ========================================
  QUARTERLY
  ========================================
  */

  const quarterlyMatch =
    text.match(quarterlyRegex)

  if (quarterlyMatch) {

    return {

      success: true,

      type: 'subscription',

      serviceName:
        quarterlyMatch[1].trim(),

      renewalMonth:
        quarterlyMatch[2],

      renewalDay:
        Number(quarterlyMatch[3]),

      recurrence:
        `${quarterlyMatch[4]} months`,

      amount:
        Number(quarterlyMatch[5])
    }
  }

  /*
  ========================================
  YEARLY
  ========================================
  */

  const yearlyMatch =
    text.match(yearlyRegex)

  if (yearlyMatch) {

    return {

      success: true,

      type: 'subscription',

      serviceName:
        yearlyMatch[1].trim(),

      renewalMonth:
        yearlyMatch[2],

      renewalDay:
        Number(yearlyMatch[3]),

      recurrence:
        'yearly',

      amount:
        Number(yearlyMatch[4])
    }
  }

  return {
    success: false
  }
}

module.exports =
  parseMessage