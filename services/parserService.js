function parseMessage(text) {

  /*
  ========================================
  ORIGINAL PATTERNS
  ========================================
  */

  const monthlyRegex =
    /^(.+?) renews on (\d+)(?:st|nd|rd|th)? every month - (\d+)$/i

  const quarterlyRegex =
    /^(.+?) renews on ([A-Za-z]+) (\d+) every (\d+) months - (\d+)$/i

  const yearlyRegex =
    /^(.+?) renews on ([A-Za-z]+) (\d+) every year - (\d+)$/i

  /*
  ========================================
  NEW PATTERNS
  ========================================
  */

  const simpleMonthlyRegex =
    /^(.+?)\s+₹?(\d+)\s+monthly$/i

  const monthlyAmountRegex =
    /^(.+?)\s+₹?(\d+)\s+(every month|monthly)$/i

  const simpleYearlyRegex =
    /^(.+?)\s+₹?(\d+)\s+yearly$/i

  const yearlyAmountRegex =
    /^(.+?)\s+yearly\s+₹?(\d+)$/i

  const recurringRegex =
    /^(.+?)\s+every\s+(\d+)\s+months\s*-\s*₹?(\d+)$/i

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
      serviceName: monthlyMatch[1].trim(),
      renewalDay: Number(monthlyMatch[2]),
      renewalMonth: null,
      recurrence: 'monthly',
      amount: Number(monthlyMatch[3])
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
      serviceName: quarterlyMatch[1].trim(),
      renewalMonth: quarterlyMatch[2],
      renewalDay: Number(quarterlyMatch[3]),
      recurrence: `${quarterlyMatch[4]} months`,
      amount: Number(quarterlyMatch[5])
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
      serviceName: yearlyMatch[1].trim(),
      renewalMonth: yearlyMatch[2],
      renewalDay: Number(yearlyMatch[3]),
      recurrence: 'yearly',
      amount: Number(yearlyMatch[4])
    }
  }

  /*
  ========================================
  SIMPLE MONTHLY
  ========================================
  */

  const simpleMonthlyMatch =
    text.match(simpleMonthlyRegex)

  if (simpleMonthlyMatch) {

    return {
      success: true,
      type: 'subscription',
      serviceName: simpleMonthlyMatch[1].trim(),
      renewalDay: null,
      renewalMonth: null,
      recurrence: 'monthly',
      amount: Number(simpleMonthlyMatch[2])
    }
  }

  /*
  ========================================
  MONTHLY AMOUNT
  ========================================
  */

  const monthlyAmountMatch =
    text.match(monthlyAmountRegex)

  if (monthlyAmountMatch) {

    return {
      success: true,
      type: 'subscription',
      serviceName: monthlyAmountMatch[1].trim(),
      renewalDay: null,
      renewalMonth: null,
      recurrence: 'monthly',
      amount: Number(monthlyAmountMatch[2])
    }
  }

  /*
  ========================================
  SIMPLE YEARLY
  ========================================
  */

  const simpleYearlyMatch =
    text.match(simpleYearlyRegex)

  if (simpleYearlyMatch) {

    return {
      success: true,
      type: 'subscription',
      serviceName: simpleYearlyMatch[1].trim(),
      renewalDay: null,
      renewalMonth: null,
      recurrence: 'yearly',
      amount: Number(simpleYearlyMatch[2])
    }
  }

  /*
  ========================================
  YEARLY AMOUNT
  ========================================
  */

  const yearlyAmountMatch =
    text.match(yearlyAmountRegex)

  if (yearlyAmountMatch) {

    return {
      success: true,
      type: 'subscription',
      serviceName: yearlyAmountMatch[1].trim(),
      renewalDay: null,
      renewalMonth: null,
      recurrence: 'yearly',
      amount: Number(yearlyAmountMatch[2])
    }
  }

  /*
  ========================================
  EVERY X MONTHS
  ========================================
  */

  const recurringMatch =
    text.match(recurringRegex)

  if (recurringMatch) {

    return {
      success: true,
      type: 'subscription',
      serviceName: recurringMatch[1].trim(),
      renewalDay: null,
      renewalMonth: null,
      recurrence: `${recurringMatch[2]} months`,
      amount: Number(recurringMatch[3])
    }
  }

  return {
    success: false
  }
}

module.exports = parseMessage