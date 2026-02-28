// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const appointmentsRoutes = require("./routes/appointments");
const uploadRoutes = require("./routes/upload");
const adminRoutes = require("./routes/admin");
const billsRoutes = require("./routes/bills"); // ✅ enable now
const configRoutes = require("./routes/configRoutes"); // ✅ ADD THIS

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bills", billsRoutes); // ✅ required for MyBills page
app.use("/api/config", configRoutes); // ✅ NOW WORKS

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error", error: err?.message });
});

async function start() {
  try {
    if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI in .env");

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected to MongoDB");
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`API running on port ${port}`));
  } catch (err) {
    console.error("DB connection error:", err.message);
    process.exit(1);
  }
}

start();
