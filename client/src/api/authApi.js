import api from "./api"
import { normalizeWhatsAppInput } from "../utils/phone"

export const sendOtp = ({ email, phone, channel = "whatsapp" }) =>
    api.post("/auth/send-otp", { email, phone: normalizeWhatsAppInput(phone), channel })

export const verifyOtp = ({ email, otp, phone }) =>
    api.post("/auth/verify-otp", { email, otp, phone: normalizeWhatsAppInput(phone) })
