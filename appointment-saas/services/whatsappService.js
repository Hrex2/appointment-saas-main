const User = require("../models/User")
const Appointment = require("../models/Appointment")
const {
    buildAppointmentIdentifierClauses,
    buildLegacyIdentityClauses,
    generateSixDigitCode,
    normalizePhone
} = require("../utils/helpers")

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date)
const isValidTime = (time) => /^\d{1,2}:\d{2}(AM|PM)$/i.test(time)

const isRestartCommand = (msg = "") => {
    const normalized = String(msg || "").trim().toLowerCase()
    return ["hi", "hello", "menu", "start", "restart", "reset"].includes(normalized)
}

const getLanguageFromInput = (msg = "") => {
    const normalized = String(msg || "").trim().toLowerCase()

    if (["1", "en", "eng", "english"].includes(normalized)) {
        return "en"
    }

    if (["2", "hi", "hin", "hindi"].includes(normalized)) {
        return "hi"
    }

    if (["3", "pa", "punjabi", "panjabi"].includes(normalized)) {
        return "pa"
    }

    return null
}

const normalizeCommand = (msg = "") =>
    String(msg || "").trim().toLowerCase()

const includesAny = (value, phrases = []) =>
    phrases.some((phrase) => value.includes(phrase))

const getMenuAction = (msg = "", language = "en") => {
    const normalized = normalizeCommand(msg)

    if (normalized === "1") {
        return "book"
    }

    if (normalized === "2") {
        return "view"
    }

    if (normalized === "3") {
        return "cancel"
    }

    const commandMap = {
        en: {
            book: ["book", "book appointment", "booking", "new booking"],
            view: ["view", "view appointments", "appointments", "list", "show appointments"],
            cancel: ["cancel", "cancel appointment", "delete", "remove appointment"]
        },
        hi: {
            book: ["बुक", "बुक करें", "अपॉइंटमेंट बुक करें", "बुकिंग"],
            view: ["देखें", "अपॉइंटमेंट देखें", "अपॉइंटमेंट", "लिस्ट", "सूची"],
            cancel: ["रद्द", "रद्द करें", "अपॉइंटमेंट रद्द करें", "कैंसल"]
        },
        pa: {
            book: ["ਬੁੱਕ", "ਬੁੱਕ ਕਰੋ", "ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ ਕਰੋ"],
            view: ["ਵੇਖੋ", "ਅਪਾਇੰਟਮੈਂਟ ਵੇਖੋ", "ਲਿਸਟ", "ਸੂਚੀ"],
            cancel: ["ਰੱਦ", "ਰੱਦ ਕਰੋ", "ਅਪਾਇੰਟਮੈਂਟ ਰੱਦ ਕਰੋ", "ਕੈਂਸਲ"]
        }
    }

    const commands = commandMap[language] || commandMap.en

    if (commands.book.includes(normalized)) {
        return "book"
    }

    if (commands.view.includes(normalized)) {
        return "view"
    }

    if (commands.cancel.includes(normalized)) {
        return "cancel"
    }

    const naturalLanguageMap = {
        en: {
            book: [
                "book appointment",
                "i want to book",
                "new appointment",
                "create appointment",
                "book a slot",
                "schedule appointment"
            ],
            view: [
                "show my appointments",
                "show appointments",
                "view my appointments",
                "list my appointments",
                "my appointments",
                "see appointments"
            ],
            cancel: [
                "cancel my appointment",
                "cancel appointment",
                "delete appointment",
                "remove my appointment"
            ]
        },
        hi: {
            book: [
                "अपॉइंटमेंट बुक",
                "बुक करनी",
                "बुक करना",
                "नई अपॉइंटमेंट",
                "अपॉइंटमेंट बनानी"
            ],
            view: [
                "मेरी अपॉइंटमेंट",
                "अपॉइंटमेंट दिखाओ",
                "अपॉइंटमेंट देखें",
                "मेरी बुकिंग"
            ],
            cancel: [
                "अपॉइंटमेंट रद्द",
                "रद्द करनी",
                "कैंसल अपॉइंटमेंट",
                "मेरी अपॉइंटमेंट रद्द"
            ]
        },
        pa: {
            book: [
                "ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ",
                "ਬੁੱਕ ਕਰਨੀ",
                "ਨਵੀਂ ਅਪਾਇੰਟਮੈਂਟ",
                "ਸਲਾਟ ਬੁੱਕ"
            ],
            view: [
                "ਮੇਰੀ ਅਪਾਇੰਟਮੈਂਟ",
                "ਅਪਾਇੰਟਮੈਂਟ ਵੇਖੋ",
                "ਮੇਰੀ ਬੁੱਕਿੰਗ",
                "ਅਪਾਇੰਟਮੈਂਟ ਦਿਖਾਓ"
            ],
            cancel: [
                "ਅਪਾਇੰਟਮੈਂਟ ਰੱਦ",
                "ਰੱਦ ਕਰਨੀ",
                "ਮੇਰੀ ਅਪਾਇੰਟਮੈਂਟ ਰੱਦ",
                "ਕੈਂਸਲ ਅਪਾਇੰਟਮੈਂਟ"
            ]
        }
    }

    const phrases = naturalLanguageMap[language] || naturalLanguageMap.en

    if (includesAny(normalized, phrases.book)) {
        return "book"
    }

    if (includesAny(normalized, phrases.view)) {
        return "view"
    }

    if (includesAny(normalized, phrases.cancel)) {
        return "cancel"
    }

    return null
}

const content = {
    en: {
        languagePrompt:
            "Choose language:\n1. English\n2. Hindi\n3. Punjabi",
        invalidLanguage:
            "Invalid option. Choose 1, 2 or 3 for language.",
        welcomeNew:
            "Welcome! What is your name?",
        welcomeBack: (name) =>
            `Welcome back ${name}!\n\nChoose:\n1. Book Appointment\n2. View Appointments\n3. Cancel Appointment`,
        welcomeNamed: (name) =>
            `Welcome ${name}!\n\nChoose:\n1. Book Appointment\n2. View Appointments\n3. Cancel Appointment`,
        invalidMenu:
            "Invalid option. Choose 1, 2 or 3.",
        askAppointmentName:
            "Enter appointment name:",
        askDate:
            "Enter date (YYYY-MM-DD):",
        invalidDate:
            "Invalid date format. Use YYYY-MM-DD.",
        askTime:
            "Enter time (e.g. 10:00AM):",
        invalidTime:
            "Invalid time format. Example: 10:00AM.",
        slotBooked:
            "This time slot is already booked. Try another time.",
        askCancelId:
            "Enter appointment ID to cancel:",
        appointmentNotFound:
            "Appointment not found.",
        noAppointments:
            "No appointments found.",
        typeHi:
            "Type HI to start.",
        booked: (appointmentCode) =>
            `Appointment booked.\nID: ${appointmentCode}\n\n1. Book\n2. View\n3. Cancel`,
        cancelled:
            "Appointment cancelled successfully.\n\n1. Book\n2. View\n3. Cancel",
        appointmentsTitle:
            "Your Appointments:"
    },
    hi: {
        languagePrompt:
            "भाषा चुनें:\n1. English\n2. हिंदी\n3. पंजाबी",
        invalidLanguage:
            "गलत विकल्प। भाषा के लिए 1, 2 या 3 चुनें।",
        welcomeNew:
            "स्वागत है! आपका नाम क्या है?",
        welcomeBack: (name) =>
            `वापसी पर स्वागत है ${name}!\n\nचुनें:\n1. अपॉइंटमेंट बुक करें\n2. अपॉइंटमेंट देखें\n3. अपॉइंटमेंट रद्द करें`,
        welcomeNamed: (name) =>
            `स्वागत है ${name}!\n\nचुनें:\n1. अपॉइंटमेंट बुक करें\n2. अपॉइंटमेंट देखें\n3. अपॉइंटमेंट रद्द करें`,
        invalidMenu:
            "गलत विकल्प। 1, 2 या 3 चुनें।",
        askAppointmentName:
            "अपॉइंटमेंट का नाम लिखें:",
        askDate:
            "तारीख लिखें (YYYY-MM-DD):",
        invalidDate:
            "गलत तारीख प्रारूप। YYYY-MM-DD इस्तेमाल करें।",
        askTime:
            "समय लिखें (जैसे 10:00AM):",
        invalidTime:
            "गलत समय प्रारूप। उदाहरण: 10:00AM.",
        slotBooked:
            "यह समय पहले से बुक है। दूसरा समय चुनें।",
        askCancelId:
            "रद्द करने के लिए अपॉइंटमेंट ID लिखें:",
        appointmentNotFound:
            "अपॉइंटमेंट नहीं मिली।",
        noAppointments:
            "कोई अपॉइंटमेंट नहीं मिली।",
        typeHi:
            "शुरू करने के लिए HI लिखें।",
        booked: (appointmentCode) =>
            `अपॉइंटमेंट बुक हो गई।\nID: ${appointmentCode}\n\n1. बुक करें\n2. देखें\n3. रद्द करें`,
        cancelled:
            "अपॉइंटमेंट सफलतापूर्वक रद्द हो गई।\n\n1. बुक करें\n2. देखें\n3. रद्द करें",
        appointmentsTitle:
            "आपकी अपॉइंटमेंट:"
    },
    pa: {
        languagePrompt:
            "ਭਾਸ਼ਾ ਚੁਣੋ:\n1. English\n2. Hindi\n3. ਪੰਜਾਬੀ",
        invalidLanguage:
            "ਗਲਤ ਵਿਕਲਪ। ਭਾਸ਼ਾ ਲਈ 1, 2 ਜਾਂ 3 ਚੁਣੋ।",
        welcomeNew:
            "ਜੀ ਆਇਆਂ ਨੂੰ! ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ?",
        welcomeBack: (name) =>
            `ਵਾਪਸੀ ਤੇ ਸਵਾਗਤ ਹੈ ${name}!\n\nਚੁਣੋ:\n1. ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ ਕਰੋ\n2. ਅਪਾਇੰਟਮੈਂਟ ਵੇਖੋ\n3. ਅਪਾਇੰਟਮੈਂਟ ਰੱਦ ਕਰੋ`,
        welcomeNamed: (name) =>
            `ਜੀ ਆਇਆਂ ਨੂੰ ${name}!\n\nਚੁਣੋ:\n1. ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ ਕਰੋ\n2. ਅਪਾਇੰਟਮੈਂਟ ਵੇਖੋ\n3. ਅਪਾਇੰਟਮੈਂਟ ਰੱਦ ਕਰੋ`,
        invalidMenu:
            "ਗਲਤ ਵਿਕਲਪ। 1, 2 ਜਾਂ 3 ਚੁਣੋ।",
        askAppointmentName:
            "ਅਪਾਇੰਟਮੈਂਟ ਦਾ ਨਾਮ ਲਿਖੋ:",
        askDate:
            "ਤਾਰੀਖ ਲਿਖੋ (YYYY-MM-DD):",
        invalidDate:
            "ਗਲਤ ਤਾਰੀਖ ਫਾਰਮੈਟ। YYYY-MM-DD ਵਰਤੋ।",
        askTime:
            "ਸਮਾਂ ਲਿਖੋ (ਜਿਵੇਂ 10:00AM):",
        invalidTime:
            "ਗਲਤ ਸਮਾਂ ਫਾਰਮੈਟ। ਉਦਾਹਰਨ: 10:00AM.",
        slotBooked:
            "ਇਹ ਸਮਾਂ ਪਹਿਲਾਂ ਹੀ ਬੁੱਕ ਹੈ। ਹੋਰ ਸਮਾਂ ਚੁਣੋ।",
        askCancelId:
            "ਰੱਦ ਕਰਨ ਲਈ ਅਪਾਇੰਟਮੈਂਟ ID ਲਿਖੋ:",
        appointmentNotFound:
            "ਅਪਾਇੰਟਮੈਂਟ ਨਹੀਂ ਮਿਲੀ।",
        noAppointments:
            "ਕੋਈ ਅਪਾਇੰਟਮੈਂਟ ਨਹੀਂ ਮਿਲੀ।",
        typeHi:
            "ਸ਼ੁਰੂ ਕਰਨ ਲਈ HI ਲਿਖੋ।",
        booked: (appointmentCode) =>
            `ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ ਹੋ ਗਈ।\nID: ${appointmentCode}\n\n1. ਬੁੱਕ ਕਰੋ\n2. ਵੇਖੋ\n3. ਰੱਦ ਕਰੋ`,
        cancelled:
            "ਅਪਾਇੰਟਮੈਂਟ ਸਫਲਤਾਪੂਰਵਕ ਰੱਦ ਹੋ ਗਈ।\n\n1. ਬੁੱਕ ਕਰੋ\n2. ਵੇਖੋ\n3. ਰੱਦ ਕਰੋ",
        appointmentsTitle:
            "ਤੁਹਾਡੀਆਂ ਅਪਾਇੰਟਮੈਂਟਾਂ:"
    }
}

const getText = (language = "en") => content[language] || content.en

const buildAppointmentsReply = (list, language) => {
    const text = getText(language)
    let reply = `${text.appointmentsTitle}\n`

    list.forEach((a) => {
        reply += `\nID: ${a.appointmentCode || a._id}\n${a.name} - ${a.date} ${a.time} (${a.status})\n`
    })

    return reply
}

const buildUserAppointmentFilter = (user) => {
    const identityClauses = buildLegacyIdentityClauses(user)
    return identityClauses.length === 1 ? identityClauses[0] : { $or: identityClauses }
}

const createUniqueAppointmentCode = async () => {
    let appointmentCode
    let exists = true

    while (exists) {
        appointmentCode = generateSixDigitCode()
        exists = await Appointment.exists({ appointmentCode })
    }

    return appointmentCode
}

const resetConversation = async (user) => {
    user.step = "select_language"
    user.conversationResetAt = new Date()
    user.tempName = ""
    user.tempDate = ""
    await user.save()
}

exports.handleMessage = async (phone, msg) => {
    phone = normalizePhone(phone)
    msg = msg.trim()

    let user = await User.findOne({ phone })

    if (!user) {
        user = await User.create({
            phone,
            name: "",
            language: "en",
            conversationResetAt: new Date(),
            step: "select_language"
        })
        return content.en.languagePrompt
    }

    if (isRestartCommand(msg)) {
        await resetConversation(user)
        return content.en.languagePrompt
    }

    // Refresh the user immediately before interpreting the state machine so a
    // rapid follow-up message (for example "Hi" then "2") sees the latest
    // saved step instead of stale state from a concurrent webhook request.
    user = await User.findById(user._id)

    if (!user) {
        return content.en.languagePrompt
    }

    if (user.step === "select_language") {
        const language = getLanguageFromInput(msg)

        if (!language) {
            return content.en.invalidLanguage
        }

        user.language = language
        user.conversationResetAt = undefined
        user.tempName = ""
        user.tempDate = ""

        if (!user.name) {
            user.step = "ask_name"
            await user.save()
            return getText(language).welcomeNew
        }

        user.step = "menu"
        await user.save()
        return getText(language).welcomeBack(user.name)
    }

    const text = getText(user.language)

    if (user.step === "ask_name") {
        user.name = msg
        user.step = "menu"
        await user.save()

        return text.welcomeNamed(user.name)
    }

    if (user.step === "menu") {
        const action = getMenuAction(msg, user.language)

        if (action === "book") {
            user.step = "ask_appt_name"
            await user.save()
            return text.askAppointmentName
        }

        if (action === "view") {
            const list = await Appointment.find(buildUserAppointmentFilter(user)).sort({ createdAt: -1 })

            if (list.length === 0) {
                return text.noAppointments
            }

            return buildAppointmentsReply(list, user.language)
        }

        if (action === "cancel") {
            user.step = "ask_cancel_id"
            await user.save()
            return text.askCancelId
        }

        return text.invalidMenu
    }

    if (user.step === "ask_appt_name") {
        user.tempName = msg
        user.step = "ask_date"
        await user.save()
        return text.askDate
    }

    if (user.step === "ask_date") {
        if (!isValidDate(msg)) {
            return text.invalidDate
        }

        user.tempDate = msg
        user.step = "ask_time"
        await user.save()

        return text.askTime
    }

    if (user.step === "ask_time") {
        if (!isValidTime(msg)) {
            return text.invalidTime
        }

        const existing = await Appointment.findOne({
            date: user.tempDate,
            time: msg,
            status: "booked"
        })

        if (existing) {
            return text.slotBooked
        }

        const appt = new Appointment({
            userId: user._id,
            appointmentCode: await createUniqueAppointmentCode(),
            email: user.email || user.phone,
            name: user.tempName,
            date: user.tempDate,
            time: msg,
            status: "booked"
        })

        await appt.save()

        user.step = "menu"
        user.tempName = ""
        user.tempDate = ""
        await user.save()

        return text.booked(appt.appointmentCode || appt._id)
    }

    if (user.step === "ask_cancel_id") {
        const cancelled = await Appointment.findOneAndUpdate(
            {
                $and: [
                    buildUserAppointmentFilter(user),
                    { $or: buildAppointmentIdentifierClauses(msg) }
                ]
            },
            { status: "cancelled" },
            { new: true }
        )

        user.step = "menu"
        await user.save()

        if (!cancelled) {
            return text.appointmentNotFound
        }

        return text.cancelled
    }

    return text.typeHi
}
