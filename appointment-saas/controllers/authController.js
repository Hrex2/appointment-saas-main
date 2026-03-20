// controllers/authController.js

/**
 * PURPOSE:
 * Handle login + OTP verification
 */
/**
 * PURPOSE:
 * Handle login + OTP verification (secure version)
 */

const User = require("../models/User")
const { sendOTP } = require("../services/emailService")
const jwt = require("jsonwebtoken")

// 🔢 Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000)
const normalizeEmail = (value = "") => value.trim().toLowerCase()
const isAdminBypassEnabled = () => process.env.ADMIN_BYPASS_ENABLED === "true"
const isAdminBypassUser = (email) =>
    isAdminBypassEnabled() &&
    normalizeEmail(email) === normalizeEmail(process.env.ADMIN_EMAIL) &&
    process.env.ADMIN_BYPASS_CODE

// 🟢 STEP 1: SEND OTP
exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body
        console.log("sendOtp:start", { email })

        if (!email) {
            return res.status(400).json({ message: "Email is required" })
        }

        if (isAdminBypassUser(email)) {
            console.log("sendOtp:admin-bypass-available", { email })
            return res.json({ message: "Admin bypass enabled" })
        }

        const otp = generateOTP()
        console.log("sendOtp:otp-generated")

        let user = await User.findOne({ email })
        console.log("sendOtp:user-looked-up", { exists: !!user })

        if (!user) {
            user = new User({ email })
            console.log("sendOtp:user-created")
        }

        user.otp = otp
        user.otpExpiry = Date.now() + 5 * 60 * 1000 // 5 min

        await user.save()
        console.log("sendOtp:user-saved")

        await sendOTP(email, otp)
        console.log("sendOtp:email-sent")

        res.json({ message: "OTP sent" })

    } catch (err) {
        console.error("sendOtp error:", err)
        res.status(500).json({ error: err.message })
    }
}

// 🔐 STEP 2: VERIFY OTP
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp, phone } = req.body // 🔥 added phone
        console.log("verifyOtp:start", { email, hasPhone: !!phone })

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP required" })
        }

        if (isAdminBypassUser(email) && otp === process.env.ADMIN_BYPASS_CODE) {
            console.log("verifyOtp:admin-bypass-success", { email })

            let user = await User.findOne({ email })

            if (!user) {
                user = new User({ email })
            }

            if (phone) {
                user.phone = phone
            }

            await user.save()

            const token = jwt.sign(
                { email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            )

            return res.json({
                message: "Admin bypass login successful",
                token
            })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(400).json({ message: "User not found" })
        }

        if (user.otp != otp) {
            return res.status(400).json({ message: "Invalid OTP" })
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: "OTP expired" })
        }

        // 🔥 LINK WHATSAPP NUMBER (if provided)
        if (phone) {
            user.phone = phone
        }

        // 🧹 Clear OTP
        user.otp = null
        user.otpExpiry = null

        await user.save()

        // 🔑 Generate JWT
        const token = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        )

        res.json({
            message: "Login successful",
            token
        })

    } catch (err) {
        console.error("verifyOtp error:", err)
        res.status(500).json({ error: err.message })
    }
}
