// server.js

/**
 * PURPOSE:
 * Entry point of application
 * - Starts server
 * - Connects DB
 * - Loads routes
 * - Handles middleware
 */
/**
 * PURPOSE:
 * Entry point of application
 */

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path"); // ✅ ADD THIS

const connectDB = require("./config/db");
const appointmentRoutes = require("./routes/appointmentRoutes");
const authRoutes = require("./routes/authRoutes");
const logger = require("./middleware/logger");

const { handleMessage } = require("./services/whatsappService");

const app = express();

// 🔹 Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(logger);

// 🔹 API Routes
app.use("/api/appointments", appointmentRoutes);
app.use("/api/auth", authRoutes);

// 🔥 WhatsApp Webhook Route
app.post("/webhook", async (req, res) => {
  try {
    const incomingMsg = req.body.Body;
    const phone = req.body.From;

    const reply = await handleMessage(phone, incomingMsg);

    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>${reply}</Message></Response>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing message");
  }
});

// 🔥 PRODUCTION SETUP (React build serving)
app.get("/", (req, res) => {
  res.send("Backend API is running 🚀")
})

// 🔹 Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
