function normalizeServiceName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function subscriptionSignature(subscription) {
  return [
    normalizeServiceName(subscription.serviceName),
    subscription.amount,
    subscription.renewalDay,
    subscription.renewalMonth || '',
    subscription.recurrence
  ].join('|')
}

function levenshteinDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])

  for (let column = 1; column <= right.length; column++) {
    rows[0][column] = column
  }

  for (let row = 1; row <= left.length; row++) {
    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      )
    }
  }

  return rows[left.length][right.length]
}

function orderDuplicateMatches(matches) {
  const groups = new Map()

  for (const subscription of matches) {
    const signature = subscriptionSignature(subscription)
    const group = groups.get(signature) || []
    group.push(subscription)
    groups.set(signature, group)
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (right.length !== left.length) {
        return right.length - left.length
      }

      return new Date(right[0].createdAt || 0) - new Date(left[0].createdAt || 0)
    })
    .flat()
}

function matchSubscriptionsByService(subscriptions, requestedServiceName) {
  if (!requestedServiceName) {
    return subscriptions
  }

  const requested = String(requestedServiceName).trim()
  const requestedLower = requested.toLowerCase()
  const requestedNormalized = normalizeServiceName(requested)

  const exact = subscriptions.filter(
    (subscription) => subscription.serviceName === requested
  )

  if (exact.length) {
    return orderDuplicateMatches(exact)
  }

  const caseInsensitiveExact = subscriptions.filter(
    (subscription) => subscription.serviceName.toLowerCase() === requestedLower
  )

  if (caseInsensitiveExact.length) {
    return orderDuplicateMatches(caseInsensitiveExact)
  }

  const normalizedExact = subscriptions.filter(
    (subscription) => normalizeServiceName(subscription.serviceName) === requestedNormalized
  )

  if (normalizedExact.length) {
    return orderDuplicateMatches(normalizedExact)
  }

  return subscriptions
    .map((subscription) => ({
      subscription,
      distance: levenshteinDistance(
        normalizeServiceName(subscription.serviceName),
        requestedNormalized
      )
    }))
    .filter(({ distance }) => distance <= Math.max(1, Math.floor(requestedNormalized.length * 0.25)))
    .sort((left, right) => left.distance - right.distance)
    .map(({ subscription }) => subscription)
}

module.exports = {
  matchSubscriptionsByService,
  normalizeServiceName,
  subscriptionSignature
}
