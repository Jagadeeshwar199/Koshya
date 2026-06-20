const { RULE_THRESHOLD, AI_MIN } = require('./aiReviewService')

function formatResultLine(result) {
  const amt = result.amount != null ? `₹${result.amount}` : 'amount unknown'
  return `• ${result.serviceName} — ${amt}/${result.recurrence || 'monthly'} (${result.confidence}%)`
}

function formatResultsMessage(results) {
  if (!results.length) {
    return 'No recurring subscriptions found in this statement.'
  }
  return ['📋 Subscriptions found:', '', ...results.map(formatResultLine)].join('\n')
}

function formatConfirmationMessage(results) {
  if (!results.length) {
    return 'No recurring subscriptions found in this statement.'
  }
  return [
    '📋 Possible subscriptions found:',
    '',
    ...results.map(formatResultLine),
    '',
    'Reply YES to add these, or tell me which ones to skip.'
  ].join('\n')
}

function rejectionReason(scored, aiAttempted = false) {
  const { shouldUseAi } = require('./aiReviewService')
  if (scored.confidence < AI_MIN) return 'confidence_below_ai_minimum'
  if (scored.confidence >= RULE_THRESHOLD && !scored.ruleResult.isSubscription) return 'not_a_subscription'
  if (shouldUseAi(scored.confidence) && aiAttempted) return 'ai_rejected_or_unavailable'
  if (scored.confidence < RULE_THRESHOLD) return 'confidence_below_rule_threshold'
  return 'not_a_subscription'
}

module.exports = {
  formatResultLine,
  formatResultsMessage,
  formatConfirmationMessage,
  rejectionReason,
  RULE_THRESHOLD
}
