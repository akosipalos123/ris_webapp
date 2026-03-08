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
const billsRoutes = require("./routes/bills");
const configRoutes = require("./routes/configRoutes");

const passwordResetRoutes = require("./routes/passwordResetRoutes");

const adminAuthRoutes = require("./routes/adminAuth");
const adminInvitesRoutes = require("./routes/adminInvites");
const adminUsersRoutes = require("./routes/adminUsers");
const adminBillsRouter = require("./routes/adminBills");

const app = express();

/**
 * ✅ CORS
 */
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? String(process.env.FRONTEND_URL).split(",") : []),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/health", (req, res) => res.json({ ok: true }));

// ✅ Put reset routes FIRST
app.use("/api/auth", passwordResetRoutes);

// ✅ Patient routes
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/bills", billsRoutes);
app.use("/api/config", configRoutes);

// ✅ Admin auth + management routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/invites", adminInvitesRoutes);
app.use("/api/admin/users", adminUsersRoutes);

// ✅ IMPORTANT: mount /api/admin/bills BEFORE /api/admin
app.use("/api/admin/bills", adminBillsRouter);

// ✅ Existing admin APIs
app.use("/api/admin", adminRoutes);

// ✅ centralized error handler (keep LAST)
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