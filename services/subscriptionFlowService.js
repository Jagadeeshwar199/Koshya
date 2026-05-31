const parseMessage = require('./parserService')
const { createSubscription } = require('./subscriptionService')
const {
  getPending,
  setPending,
  clearPending
} = require('./pendingSubscriptionService')
const { sendWhatsAppMessage } = require('./whatsappService')

function buildQuestions(missing) {
  const lines = []

  if (missing.includes('serviceName')) {
    lines.push('• Which service? (e.g. Netflix, Spotify)')
  }
  if (missing.includes('amount')) {
    lines.push('• What amount in ₹? (e.g. 149)')
  }
  if (missing.includes('recurrence')) {
    lines.push('• How often? Reply: monthly, yearly, or every 3 months')
  }
  if (missing.includes('renewalDate')) {
    lines.push('• Renewal date? (e.g. 27th or Jan 20)')
  }

  return lines.join('\n')
}

function formatSaved(parsed) {
  const datePart = [parsed.renewalMonth, parsed.renewalDay]
    .filter(Boolean)
    .join(' ')

  return `✅ Subscription Saved

📦 ${parsed.serviceName}
💰 ₹${parsed.amount}
${datePart ? `📅 ${datePart}\n` : ''}🔁 ${parsed.recurrence}`
}

async function saveAndReply(sender, parsed) {
  const result = await createSubscription({
    userPhone: sender,
    serviceName: parsed.serviceName,
    amount: parsed.amount,
    renewalDay: parsed.renewalDay,
    renewalMonth: parsed.renewalMonth,
    recurrence: parsed.recurrence
  })

  if (!result.success) {
    console.log('SUBSCRIPTION ERROR:', JSON.stringify(result.error, null, 2))
    await sendWhatsAppMessage(sender, '❌ Failed to save subscription. Please try again.')
    return { ok: false }
  }

  await clearPending(sender)
  await sendWhatsAppMessage(sender, formatSaved(parsed))
  return { ok: true }
}

async function handleSubscriptionMessage(sender, text) {
  const pending = await getPending(sender)
  const parsed = parseMessage(text, pending)

  console.log('PARSED RESULT:', JSON.stringify(parsed, null, 2))

  if (parsed.type === 'subscription' && parsed.success) {
    return saveAndReply(sender, parsed)
  }

  if (parsed.type === 'incomplete') {
    await setPending(sender, parsed.draft)

    const intro = parsed.draft.serviceName
      ? `Got ${parsed.draft.serviceName}. I need a bit more:`
      : `Almost there — I need:`

    await sendWhatsAppMessage(
      sender,
      `${intro}\n\n${buildQuestions(parsed.missing)}\n\nReply in one message, e.g. "149 monthly on 27th"`
    )
    return { ok: true, asked: true }
  }

  if (pending) {
    await clearPending(sender)
  }

  await sendWhatsAppMessage(
    sender,
    `⚠️ Could not understand subscription.

Examples:
Netflix renews on 27th every month - 149
JioHotstar renews on Apr 12 every 3 months - 599`
  )
  return { ok: true, unknown: true }
}

module.exports = {
  handleSubscriptionMessage,
  buildQuestions
}
