const mongoose = require("mongoose")

const emptyToUndefined = (value) => {
    if (value === null || typeof value === "undefined") {
        return undefined
    }

    if (typeof value === "string" && value.trim() === "") {
        return undefined
    }

    return value
}

const workingHoursSchema = new mongoose.Schema({
    start: {
        type: String,
        default: "09:00"
    },
    end: {
        type: String,
        default: "18:00"
    },
    timezone: {
        type: String,
        default: "Asia/Kolkata"
    },
    days: {
        type: [String],
        default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    }
}, { _id: false })

const businessSettingsSchema = new mongoose.Schema({
    businessName: {
        type: String,
        default: "Neon Appointments"
    },
    phoneNumber: {
        type: String,
        default: ""
    },
    whatsappNumber: {
        type: String,
        default: ""
    },
    workingHours: {
        type: workingHoursSchema,
        default: () => ({})
    },
    fee: {
        type: Number,
        default: 0
    },
    address: {
        type: String,
        default: ""
    }
}, { _id: false })

const subscriptionUsageSchema = new mongoose.Schema({
    appointmentCount: {
        type: Number,
        default: 0
    },
    appointmentLimit: {
        type: Number,
        default: 25
    }
}, { _id: false })

const subscriptionSchema = new mongoose.Schema({
    planKey: {
        type: String,
        default: "free"
    },
    planName: {
        type: String,
        default: "Free"
    },
    tierLevel: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["active", "expiring", "expired", "trialing"],
        default: "active"
    },
    nextPaymentDate: Date,
    currentPeriodEnd: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    usage: {
        type: subscriptionUsageSchema,
        default: () => ({})
    }
}, { _id: false })

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        set: emptyToUndefined
    },
    phone: {
        type: String,
        set: emptyToUndefined
    },
    name: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user"
    },
    language: {
        type: String,
        enum: ["en", "hi", "pa"],
        default: "en"
    },
    businessSettings: {
        type: businessSettingsSchema,
        default: () => ({})
    },
    subscription: {
        type: subscriptionSchema,
        default: () => ({})
    },
    otp: String,
    otpExpiry: Date,
    otpLastSentAt: Date,
    otpRequestCount: {
        type: Number,
        default: 0
    },
    step: {
        type: String,
        default: "start"
    },
    conversationResetAt: Date,
    tempName: String,
    tempDate: String
}, { timestamps: true })

userSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: {
            email: { $exists: true, $type: "string" }
        }
    }
)

userSchema.index(
    { phone: 1 },
    {
        unique: true,
        partialFilterExpression: {
            phone: { $exists: true, $type: "string" }
        }
    }
)

module.exports = mongoose.model("User", userSchema)
