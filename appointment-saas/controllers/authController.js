const User = require("../models/User")
const { sendOTP } = require("../services/emailService")
const { sendWhatsAppOTP } = require("../services/whatsappOtpService")
const jwt = require("jsonwebtoken")
const { normalizeEmail, normalizePhone } = require("../utils/helpers")

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RATE_LIMIT_MS = 60 * 1000

const generateOTP = () => Math.floor(100000 + Math.random() * 900000)

const isAdminBypassEnabled = () => process.env.ADMIN_BYPASS_ENABLED === "true"

const isAdminBypassUser = (email) =>
    isAdminBypassEnabled() &&
    normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL) &&
    process.env.ADMIN_BYPASS_CODE

const buildDefaultBusinessSettings = (user) => ({
    businessName: user.name ? `${user.name}'s Studio` : "Neon Appointments",
    phoneNumber: user.phone || "",
    whatsappNumber: user.phone || "",
    workingHours: {
        start: "09:00",
        end: "18:00",
        timezone: "Asia/Kolkata",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },
    fee: 0,
    address: ""
})

const buildDefaultSubscription = () => ({
    planKey: "free",
    planName: "Free",
    tierLevel: 0,
    status: "active",
    usage: {
        appointmentCount: 0,
        appointmentLimit: 25
    }
})

const issueAuthPayload = (user) => {
    const token = jwt.sign(
        { email: user.email, userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    return {
        message: "Login successful",
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            createdAt: user.createdAt
        },
        businessSettings: user.businessSettings,
        subscription: user.subscription
    }
}

const ensureUserScaffold = (user) => {
    if (!user.businessSettings || !user.businessSettings.businessName) {
        user.businessSettings = buildDefaultBusinessSettings(user)
    }

    if (!user.subscription || !user.subscription.planKey) {
        user.subscription = buildDefaultSubscription()
    }
}

const linkUserByPhone = async (user, phone) => {
    const normalizedPhone = normalizePhone(phone)

    if (!normalizedPhone) {
        ensureUserScaffold(user)
        return user
    }

    const phoneOwner = await User.findOne({ phone: normalizedPhone })

    if (!phoneOwner || String(phoneOwner._id) === String(user._id)) {
        user.phone = normalizedPhone
        ensureUserScaffold(user)
        user.businessSettings = {
            ...buildDefaultBusinessSettings(user),
            ...user.businessSettings?.toObject?.(),
            phoneNumber: normalizedPhone,
            whatsappNumber: normalizedPhone
        }
        return user
    }

    if (phoneOwner.email && normalizeEmail(phoneOwner.email) !== normalizeEmail(user.email)) {
        throw new Error("This phone number is already linked to another account")
    }

    // Prefer the email-owned account as the primary record when both records belong
    // to the same person. This avoids saving two documents with the same unique email.
    user.phone = normalizedPhone
    user.otp = null
    user.otpExpiry = null

    if (!user.name && phoneOwner.name) {
        user.name = phoneOwner.name
    }

    if (!user.language && phoneOwner.language) {
        user.language = phoneOwner.language
    }

    ensureUserScaffold(user)
    user.businessSettings = {
        ...buildDefaultBusinessSettings(user),
        ...phoneOwner.businessSettings?.toObject?.(),
        ...user.businessSettings?.toObject?.(),
        phoneNumber: normalizedPhone,
        whatsappNumber: normalizedPhone
    }

    if (phoneOwner.subscription?.planKey && (!user.subscription || user.subscription.planKey === "free")) {
        user.subscription = phoneOwner.subscription
    }

    await user.save()
    await User.deleteOne({ _id: phoneOwner._id })

    return user
}

const findOrCreateUserForOtp = async (email, phone) => {
    const normalizedEmail = normalizeEmail(email)
    const normalizedPhone = normalizePhone(phone)

    let user = null

    if (normalizedEmail) {
        user = await User.findOne({ email: normalizedEmail })
    }

    if (!user && normalizedPhone) {
        user = await User.findOne({ phone: normalizedPhone })
        if (user && normalizedEmail && !user.email) {
            user.email = normalizedEmail
        }
    }

    if (!user) {
        user = new User({
            email: normalizedEmail || undefined,
            phone: normalizedPhone || undefined
        })
    }

    ensureUserScaffold(user)
    return user
}

exports.sendOtp = async (req, res) => {
    try {
        const { email = "", phone = "", channel = "whatsapp" } = req.body
        console.log("sendOtp:start", { email, phone, channel })

        if (!email) {
            return res.status(400).json({ message: "Email is required" })
        }

        if (isAdminBypassUser(email)) {
            return res.json({ message: "Admin bypass enabled" })
        }

        const otp = generateOTP()
        const user = await findOrCreateUserForOtp(email, phone)

        if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_RATE_LIMIT_MS) {
            return res.status(429).json({ message: "Please wait before requesting another OTP" })
        }

        user.otp = otp
        user.otpExpiry = Date.now() + OTP_TTL_MS
        user.otpLastSentAt = new Date()
        user.otpRequestCount = Number(user.otpRequestCount || 0) + 1

        if (!user.role) {
            user.role = normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL) ? "admin" : "user"
        }

        await user.save()

        if (channel === "whatsapp") {
            if (!phone) {
                return res.status(400).json({ message: "WhatsApp phone is required for WhatsApp OTP" })
            }

            console.log("sendOtp:dispatch-whatsapp", { email, phone })
            const message = await sendWhatsAppOTP(phone, otp)
            return res.json({
                message: "OTP sent to WhatsApp",
                delivery: {
                    sid: message.sid,
                    status: message.status
                }
            })
        }

        await sendOTP(email, otp)
        res.json({ message: "OTP sent to email" })
    } catch (err) {
        console.error("sendOtp error:", {
            message: err.message,
            code: err.code,
            status: err.status,
            moreInfo: err.moreInfo
        })
        res.status(500).json({ error: err.message })
    }
}

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp, phone } = req.body

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP required" })
        }

        if (isAdminBypassUser(email) && otp === process.env.ADMIN_BYPASS_CODE) {
            let user = await User.findOne({ email: normalizeEmail(email) })

            if (!user) {
                user = new User({
                    email: normalizeEmail(email),
                    role: "admin"
                })
            }

            user = await linkUserByPhone(user, phone)
            user.role = "admin"
            ensureUserScaffold(user)
            await user.save()

            return res.json(issueAuthPayload(user))
        }

        const user = await User.findOne({ email: normalizeEmail(email) })

        if (!user) {
            return res.status(400).json({ message: "User not found" })
        }

        if (String(user.otp) !== String(otp)) {
            return res.status(400).json({ message: "Invalid OTP" })
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired" })
        }

        user.otp = null
        user.otpExpiry = null

        const linkedUser = await linkUserByPhone(user, phone)

        if (normalizeEmail(linkedUser.email) === normalizeEmail(process.env.ADMIN_EMAIL)) {
            linkedUser.role = "admin"
        }

        ensureUserScaffold(linkedUser)
        await linkedUser.save()

        res.json(issueAuthPayload(linkedUser))
    } catch (err) {
        console.error("verifyOtp error:", err)
        res.status(500).json({ error: err.message })
    }
}
