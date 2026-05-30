const supabase =
  require('../config/supabase')

const parseMessage =
  require('../services/parserService')

const {
  createSubscription
} = require('../services/subscriptionService')

const {
  sendWhatsAppMessage
} = require('../services/whatsappService')

/*
========================================
VERIFY WEBHOOK
========================================
*/

const verifyWebhook = (
  req,
  res
) => {

  res
    .status(200)
    .send('Webhook live')
}

/*
========================================
HANDLE WEBHOOK
========================================
*/

const handleWebhook = async (
  req,
  res
) => {

  try {

    /*
    ========================================
    FULL PAYLOAD LOG
    ========================================
    */

    console.log(
      'FULL PAYLOAD:',
      JSON.stringify(req.body, null, 2)
    )

    console.log('\n==============================')
    console.log('NEW WHATSAPP MESSAGE')
    console.log('==============================')

    const value =
      req.body.entry?.[0]
        ?.changes?.[0]
        ?.value

    /*
    ========================================
    STATUS EVENTS
    ========================================
    */

    const statusUpdate =
      value?.statuses?.[0]

    if (statusUpdate) {

      console.log(
        `📬 Status: ${statusUpdate.status}`
      )

      return res.sendStatus(200)
    }

    /*
    ========================================
    MESSAGE
    ========================================
    */

    const incomingMessage =
      value?.messages?.[0]

    if (!incomingMessage) {

      return res.sendStatus(200)
    }

    /*
    ========================================
    TEXT ONLY
    ========================================
    */

    if (incomingMessage.type !== 'text') {

      return res.sendStatus(200)
    }

    const sender =
      incomingMessage.from

    const text = (
      incomingMessage.text?.body || ''
    ).trim()

    console.log('📱 Sender:', sender)
    console.log('💬 Message:', text)

    /*
    ========================================
    SAVE RAW MESSAGE
    ========================================
    */

    await supabase
      .from('messages')
      .insert([
        {
          user_phone: sender,
          message: text
        }
      ])

    /*
    ========================================
    HI FLOW
    ========================================
    */

    const lowerText =
      text.toLowerCase().trim()

    if (
      lowerText === 'hi' ||
      lowerText === 'hello'
    ) {

      await sendWhatsAppMessage(

        sender,

`👋 Welcome to Koshya

I help you remember subscription renewals.

Send subscriptions like this:

Netflix renews on 28th every month - 249

JioHotstar renews on Jan 12 every 3 months - 599

Prime renews on Jan 20 every year - 1499`

      )

      return res.sendStatus(200)
    }

    /*
    ========================================
    PARSE MESSAGE
    ========================================
    */

   const parsed =
  parseMessage(text)

console.log(
  'PARSED RESULT:',
  JSON.stringify(parsed, null, 2)
)

    /*
    ========================================
    SUBSCRIPTION FLOW
    ========================================
    */

    if (
      parsed.type ===
      'subscription'
    ) {

      const result =
        await createSubscription({

          userPhone:
            sender,

          serviceName:
            parsed.serviceName,

          amount:
            parsed.amount,

          renewalDay:
            parsed.renewalDay,

          renewalMonth:
            parsed.renewalMonth,

          recurrence:
            parsed.recurrence
        })

      if (!result.success) {

  console.log(
    'SUBSCRIPTION ERROR:',
    JSON.stringify(
      result.error,
      null,
      2
    )
  )

  await sendWhatsAppMessage(

    sender,

    '❌ Failed to save subscription'
  )

  return res.sendStatus(200)
}

      await sendWhatsAppMessage(

        sender,

`✅ Subscription Saved

📦 ${parsed.serviceName}
💰 ₹${parsed.amount}

📅 ${parsed.renewalMonth || ''} ${parsed.renewalDay}

🔁 ${parsed.recurrence}`

      )

      return res.sendStatus(200)
    }

    /*
    ========================================
    UNKNOWN MESSAGE
    ========================================
    */

    await sendWhatsAppMessage(

      sender,

`⚠️ Could not understand subscription.

Examples:

Netflix renews on 28th every month - 249

JioHotstar renews on Jan 12 every 3 months - 599`

    )

    return res.sendStatus(200)

  } catch (err) {

    console.error(
      '❌ Webhook Error:',
      err
    )

    return res.sendStatus(500)
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook
}