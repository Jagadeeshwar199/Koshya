const supabase =
  require('../config/supabase')

const {
  handleSubscriptionMessage
} = require('../services/subscriptionFlowService')

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

    await handleSubscriptionMessage(sender, text)
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