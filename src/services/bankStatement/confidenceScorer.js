const SUB_HINT = /\b(?:NETFLIX|SPOTIFY|PRIME|HOTSTAR|DISNEY|YOUTUBE|APPLE|MICROSOFT|ADOBE|FIBERNET|ZOOM|OPENAI)\b/i

function scoreRecurringCandidate(group) {
  let recurring = 0
  let interval = 0
  let amount = 0
  let merchant = 0

  if (group.occurrenceCount >= 3) recurring = 15
  else if (group.occurrenceCount >= 2) recurring = 8

  if (group.sameAmount) amount = 25
  if (group.recurrence) interval = 25

  if (group.dominantType === 'subscription' || SUB_HINT.test(group.normalizedName)) {
    merchant = 30
  } else if (group.dominantType === 'utility') {
    merchant = 15
  }

  if (group.medianAmount && group.medianAmount >= 49 && group.medianAmount <= 5000 && amount === 0) {
    amount = 5
  }

  const total = Math.min(100, recurring + interval + amount + merchant)
  const breakdown = { recurring, interval, amount, merchant, total }

  return {
    confidence: total,
    breakdown,
    ruleResult: {
      serviceName: titleCase(group.normalizedName),
      amount: group.medianAmount,
      recurrence: group.recurrence || 'monthly',
      isSubscription: group.dominantType === 'subscription' || SUB_HINT.test(group.normalizedName)
    }
  }
}

function titleCase(v) {
  return String(v || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

module.exports = { scoreRecurringCandidate, titleCase }
