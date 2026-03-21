const mongoose = require("mongoose")

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase()

const normalizePhone = (value = "") => {
    const trimmed = String(value || "").trim()

    if (!trimmed) {
        return ""
    }

    if (trimmed.startsWith("whatsapp:")) {
        const normalized = trimmed.slice("whatsapp:".length).replace(/\s+/g, "")
        return `whatsapp:${normalized}`
    }

    const compact = trimmed.replace(/[^\d+]/g, "")

    if (/^\d{10}$/.test(compact)) {
        return `+91${compact}`
    }

    return compact
}

const formatWhatsAppPhone = (value = "") => {
    const normalizedPhone = normalizePhone(value)

    if (!normalizedPhone) {
        return ""
    }

    return normalizedPhone.startsWith("whatsapp:")
        ? normalizedPhone
        : `whatsapp:${normalizedPhone}`
}

const buildLegacyIdentityClauses = (user) => {
    const clauses = []

    if (user?._id) {
        clauses.push({ userId: user._id })
    }

    if (user?.email) {
        clauses.push({ email: normalizeEmail(user.email) })
    }

    if (user?.phone) {
        clauses.push({ email: normalizePhone(user.phone) })
    }

    return clauses
}

const buildAppointmentIdentifierClauses = (identifier) => {
    const trimmed = String(identifier || "").trim()
    const clauses = []

    if (/^\d{6}$/.test(trimmed)) {
        clauses.push({ appointmentCode: trimmed })
    }

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
        clauses.push({ _id: trimmed })
    }

    return clauses
}

const generateSixDigitCode = () =>
    String(Math.floor(100000 + Math.random() * 900000))

const formatDateKey = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

const parseTimeTo24Hour = (timeValue = "") => {
    const value = String(timeValue || "").trim().toUpperCase()

    const twelveHourMatch = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
    if (twelveHourMatch) {
        let hours = Number(twelveHourMatch[1]) % 12
        const minutes = Number(twelveHourMatch[2])
        const meridiem = twelveHourMatch[3]

        if (meridiem === "PM") {
            hours += 12
        }

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    }

    const twentyFourHourMatch = value.match(/^(\d{1,2}):(\d{2})$/)
    if (twentyFourHourMatch) {
        return `${String(Number(twentyFourHourMatch[1])).padStart(2, "0")}:${twentyFourHourMatch[2]}`
    }

    return ""
}

const buildAppointmentDates = ({ date, time, durationMinutes = 30 }) => {
    const dateKey = formatDateKey(date)
    const time24 = parseTimeTo24Hour(time)

    if (!dateKey || !time24) {
        return {
            date: dateKey || String(date || "").trim(),
            time: String(time || "").trim(),
            startAt: null,
            endAt: null,
            slotKey: ""
        }
    }

    const startAt = new Date(`${dateKey}T${time24}:00`)
    const endAt = new Date(startAt.getTime() + Number(durationMinutes || 30) * 60000)

    return {
        date: dateKey,
        time: time24,
        startAt,
        endAt,
        slotKey: `${dateKey}-${time24}`
    }
}

const isAppointmentActive = (status = "") =>
    !["cancelled", "completed", "no-show"].includes(String(status || "").toLowerCase())

module.exports = {
    normalizeEmail,
    normalizePhone,
    formatWhatsAppPhone,
    buildLegacyIdentityClauses,
    buildAppointmentIdentifierClauses,
    generateSixDigitCode,
    buildAppointmentDates,
    isAppointmentActive
}
