const axios =
  require('axios')

async function sendWhatsAppMessage(
  phone,
  text
) {

  try {

    await axios.post(

      'https://api.gupshup.io/wa/api/v1/msg',

      new URLSearchParams({

        channel: 'whatsapp',

        source: '917386901879',

        destination: phone,

        message: JSON.stringify({
          type: 'text',
          text: text
        })

      }),

      {
        headers: {

          apikey:
            process.env.GUPSHUP_API_KEY,

          'Content-Type':
            'application/x-www-form-urlencoded'
        }
      }
    )

    console.log(
      '✅ WhatsApp message sent'
    )

  } catch (err) {

    console.error(
      '❌ WhatsApp Send Error:',
      err.response?.data || err.message
    )
  }
}

module.exports = {
  sendWhatsAppMessage
}