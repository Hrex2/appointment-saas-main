export const normalizeWhatsAppInput = (value = "") => {
    const raw = String(value || "").trim()

    if (!raw) {
        return ""
    }

    if (raw.toLowerCase().startsWith("whatsapp:")) {
        const number = raw.slice("whatsapp:".length).replace(/\s+/g, "")
        return `whatsapp:${number}`
    }

    const compact = raw.replace(/[^\d+]/g, "")

    if (compact.startsWith("+")) {
        return `whatsapp:${compact}`
    }

    if (/^\d{10}$/.test(compact)) {
        return `whatsapp:+91${compact}`
    }

    return `whatsapp:+${compact}`
}

export const normalizePhoneDisplay = (value = "") => {
    const normalized = normalizeWhatsAppInput(value)

    if (!normalized) {
        return ""
    }

    return normalized.slice("whatsapp:".length)
}
