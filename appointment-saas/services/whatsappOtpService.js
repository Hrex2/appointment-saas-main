const twilio = require("twilio")
const { formatWhatsAppPhone } = require("../utils/helpers")

const getTwilioClient = () => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        throw new Error("Missing Twilio credentials for WhatsApp OTP")
    }

    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

const sendWhatsAppOTP = async (phone, otp) => {
    if (!process.env.TWILIO_WHATSAPP_FROM) {
        throw new Error("Missing TWILIO_WHATSAPP_FROM")
    }

    const client = getTwilioClient()
    const to = formatWhatsAppPhone(phone)

    if (!to) {
        throw new Error("A valid WhatsApp phone number is required")
    }

    const message = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to,
        body:
            "APPOINTMENT SAAS LOGIN OTP\n" +
            `Code: ${otp}\n` +
            "Valid for 5 minutes.\n" +
            "Do not share this code."
    })

    console.log("whatsappOtp:sent", {
        sid: message.sid,
        status: message.status,
        to,
        from: process.env.TWILIO_WHATSAPP_FROM
    })

    return message
}

module.exports = { sendWhatsAppOTP }
