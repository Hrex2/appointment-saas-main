require("dotenv").config()

const connectDB = require("../config/db")
const Appointment = require("../models/Appointment")
const User = require("../models/User")
const {
    generateSixDigitCode,
    normalizeEmail,
    normalizePhone
} = require("../utils/helpers")

const createUniqueAppointmentCode = async () => {
    let appointmentCode
    let exists = true

    while (exists) {
        appointmentCode = generateSixDigitCode()
        exists = await Appointment.exists({ appointmentCode })
    }

    return appointmentCode
}

const findLinkedUser = async (appointment) => {
    if (appointment.userId) {
        const existingUser = await User.findById(appointment.userId)
        if (existingUser) {
            return existingUser
        }
    }

    const rawIdentity = String(appointment.email || "").trim()

    if (!rawIdentity) {
        return null
    }

    const normalizedEmail = normalizeEmail(rawIdentity)
    const normalizedPhone = normalizePhone(rawIdentity)

    let user = null

    if (normalizedEmail && normalizedEmail.includes("@")) {
        user = await User.findOne({ email: normalizedEmail })
    }

    if (!user && normalizedPhone) {
        user = await User.findOne({ phone: normalizedPhone })
    }

    return user
}

const migrateAppointments = async () => {
    await connectDB()

    const appointments = await Appointment.find({}).sort({ createdAt: 1 })

    let updatedCount = 0

    for (const appointment of appointments) {
        let changed = false

        if (!appointment.appointmentCode) {
            appointment.appointmentCode = await createUniqueAppointmentCode()
            changed = true
        }

        if (appointment.email) {
            const normalizedIdentity = appointment.email.includes("@")
                ? normalizeEmail(appointment.email)
                : normalizePhone(appointment.email)

            if (normalizedIdentity && normalizedIdentity !== appointment.email) {
                appointment.email = normalizedIdentity
                changed = true
            }
        }

        const linkedUser = await findLinkedUser(appointment)

        if (linkedUser) {
            if (!appointment.userId || String(appointment.userId) !== String(linkedUser._id)) {
                appointment.userId = linkedUser._id
                changed = true
            }

            const preferredIdentity = linkedUser.email || linkedUser.phone
            if (preferredIdentity && appointment.email !== preferredIdentity) {
                appointment.email = preferredIdentity
                changed = true
            }
        }

        if (changed) {
            await appointment.save()
            updatedCount += 1
            console.log(`Updated appointment ${appointment._id} -> code ${appointment.appointmentCode}`)
        }
    }

    console.log(`Migration finished. Updated ${updatedCount} appointments out of ${appointments.length}.`)
    process.exit(0)
}

migrateAppointments().catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
})
