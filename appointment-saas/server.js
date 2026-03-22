require("dotenv").config()

const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const rateLimit = require("express-rate-limit")

const connectDB = require("./config/db")
const appointmentRoutes = require("./routes/appointmentRoutes")
const authRoutes = require("./routes/authRoutes")
const userRoutes = require("./routes/userRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const businessRoutes = require("./routes/businessRoutes")
const profileRoutes = require("./routes/profileRoutes")
const subscriptionRoutes = require("./routes/subscriptionRoutes")
const logger = require("./middleware/logger")
const { handleMessage } = require("./services/whatsappService")
const { ensureDefaultPlans } = require("./services/planService")

const app = express()
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"]
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`)
}

app.set("trust proxy", 1)

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(logger)

const otpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many OTP requests. Please try again in a minute."
    }
})

app.use("/api/auth/send-otp", otpLimiter)

app.use("/api/appointments", appointmentRoutes)
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/business", businessRoutes)
app.use("/api/profile", profileRoutes)
app.use("/api/subscriptions", subscriptionRoutes)

app.post("/webhook", async (req, res) => {
    try {
        const incomingMsg = req.body.Body
        const phone = req.body.From

        const reply = await handleMessage(phone, incomingMsg)

        res.set("Content-Type", "text/xml")
        res.send(`<Response><Message>${reply}</Message></Response>`)
    } catch (err) {
        console.error(err)
        res.status(500).send("Error processing message")
    }
})

app.get("/", (_req, res) => {
    res.send("Backend API is running")
})

const PORT = process.env.PORT || 5000

connectDB().then(async () => {
    await ensureDefaultPlans()

    console.log("app:version", {
        renderGitCommit: process.env.RENDER_GIT_COMMIT || "unknown",
        nodeEnv: process.env.NODE_ENV || "development"
    })

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
})
