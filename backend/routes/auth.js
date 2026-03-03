// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Patient = require("../models/Patient");
const RegisterOtp = require("../models/RegisterOtp");
const LoginOtp = require("../models/LoginOtp");
const Counter = require("../models/Counter");

const { sendOtpEmail } = require("../utils/mailer");

const router = express.Router();

/* -------------------- TOKEN HELPERS -------------------- */
function signToken(patientId, keepSignedIn = false) {
  const exp = keepSignedIn
    ? process.env.JWT_EXPIRES_IN_LONG || process.env.JWT_EXPIRES_IN || "30d"
    : process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ sub: patientId }, process.env.JWT_SECRET, { expiresIn: exp });
}

function signRegisterOtpToken(email) {
  return jwt.sign({ email, purpose: "register_otp" }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
}

function signLoginOtpToken(email) {
  return jwt.sign({ email, purpose: "login_otp" }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

/* -------------------- AUTH MIDDLEWARE -------------------- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/* -------------------- BSRT ID GENERATOR --------------------
   Returns: BSRT00000001, BSRT00000002, ...
   ✅ Fixed: use findByIdAndUpdate("patients", ...) (NOT { _id: "patients" })
*/
async function nextBsrtId() {
  const c = await Counter.findByIdAndUpdate(
    "patients",
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `BSRT${String(c.seq).padStart(8, "0")}`;
}

/* ============================================================
   ✅ STEP 1: POST /api/auth/login-otp
   Validates email+password then sends OTP
============================================================ */
router.post("/login-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const patient = await Patient.findOne({ email }).select("+passwordHash");
    if (!patient || !patient.isActive || patient.isArchived) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, patient.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const now = new Date();

    // rate limit per email (30s)
    let doc = await LoginOtp.findOne({ email });
    if (doc?.lastSentAt) {
      const diffMs = now.getTime() - new Date(doc.lastSentAt).getTime();
      if (diffMs < 30_000) {
        return res.status(429).json({
          message: "OTP recently sent. Please wait a moment and try again.",
        });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    if (!doc) {
      doc = await LoginOtp.create({
        email,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: now,
      });
    } else {
      doc.otpHash = otpHash;
      doc.expiresAt = expiresAt;
      doc.attempts = 0;
      doc.lastSentAt = now;
      await doc.save();
    }

    await sendOtpEmail(email, otp);

    const otpToken = signLoginOtpToken(email);

    return res.json({
      otpRequired: true,
      otpToken,
      ttlSeconds: 600,
      message: "OTP sent to your email.",
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
});

/* ============================================================
   ✅ POST /api/auth/login
   - OTP verify: { otpToken, otp, keepSignedIn }
   - Legacy: { email, password } (fallback)
============================================================ */
router.post("/login", async (req, res) => {
  try {
    const keepSignedIn = !!req.body.keepSignedIn;

    // ✅ OTP MODE
    if (req.body.otpToken && req.body.otp) {
      const otpToken = String(req.body.otpToken);
      const otp = String(req.body.otp);

      let payload;
      try {
        payload = jwt.verify(otpToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: "Invalid or expired OTP session" });
      }

      if (payload.purpose !== "login_otp" || !payload.email) {
        return res.status(401).json({ message: "Invalid OTP session" });
      }

      const email = String(payload.email).trim().toLowerCase();

      const otpDoc = await LoginOtp.findOne({ email });
      if (!otpDoc) {
        return res.status(400).json({ message: "No OTP request found. Please resend OTP." });
      }

      if (new Date() > new Date(otpDoc.expiresAt)) {
        await LoginOtp.deleteOne({ _id: otpDoc._id });
        return res.status(400).json({ message: "OTP expired. Please resend OTP." });
      }

      otpDoc.attempts = (otpDoc.attempts || 0) + 1;
      if (otpDoc.attempts > 5) {
        await LoginOtp.deleteOne({ _id: otpDoc._id });
        return res.status(429).json({ message: "Too many OTP attempts. Please resend OTP." });
      }

      const match = hashOtp(otp) === otpDoc.otpHash;
      if (!match) {
        await otpDoc.save();
        return res.status(400).json({ message: "Invalid OTP code" });
      }

      // OTP valid → consume session
      await LoginOtp.deleteOne({ _id: otpDoc._id });

      // ensure user still exists/active
      const patient = await Patient.findOne({ email });
      if (!patient || !patient.isActive || patient.isArchived) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = signToken(patient._id.toString(), keepSignedIn);
      return res.json({ token });
    }

    // ✅ LEGACY MODE
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const patient = await Patient.findOne({ email }).select("+passwordHash");
    if (!patient || !patient.isActive || patient.isArchived) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, patient.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(patient._id.toString(), keepSignedIn);
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

/* ============================================================
   ✅ STEP 1: POST /api/auth/register-otp
   Sends OTP to email (only if email not registered)
============================================================ */
router.post("/register-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email is required" });

    const existing = await Patient.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const now = new Date();

    // rate limit per email (30s)
    let doc = await RegisterOtp.findOne({ email });
    if (doc?.lastSentAt) {
      const diffMs = now.getTime() - new Date(doc.lastSentAt).getTime();
      if (diffMs < 30_000) {
        return res.status(429).json({
          message: "OTP recently sent. Please wait a moment and try again.",
        });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    if (!doc) {
      doc = await RegisterOtp.create({
        email,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: now,
      });
    } else {
      doc.otpHash = otpHash;
      doc.expiresAt = expiresAt;
      doc.attempts = 0;
      doc.lastSentAt = now;
      await doc.save();
    }

    await sendOtpEmail(email, otp);

    const otpToken = signRegisterOtpToken(email);

    return res.json({
      otpRequired: true,
      otpToken,
      ttlSeconds: 600,
      message: "OTP sent to your email.",
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
});

/* ============================================================
   ✅ STEP 2: POST /api/auth/register
   Requires otpToken + otp + user fields
   ✅ Forces role="patient"
   ✅ Generates bsrtId like BSRT00000001
============================================================ */
router.post("/register", async (req, res) => {
  try {
    const {
      otpToken,
      otp,
      email,
      password,
      firstName,
      lastName,
      middleName,
      suffix,
      gender,
      birthdate,
      contactNumber,
      address, // ✅ optional (future-proof)
    } = req.body;

    if (!otpToken || !otp) {
      return res.status(400).json({ message: "otpToken and otp are required" });
    }

    let payload;
    try {
      payload = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired OTP session" });
    }

    if (payload.purpose !== "register_otp" || !payload.email) {
      return res.status(401).json({ message: "Invalid OTP session" });
    }

    const emailClean = String(email || "").trim().toLowerCase();
    if (!emailClean) return res.status(400).json({ message: "email is required" });
    if (emailClean !== payload.email) {
      return res.status(400).json({ message: "Email mismatch. Please resend OTP." });
    }

    const fn = String(firstName || "").trim();
    const ln = String(lastName || "").trim();
    const pw = String(password || "");

    if (!pw || !fn || !ln) {
      return res.status(400).json({ message: "firstName, lastName, and password are required" });
    }

    const existing = await Patient.findOne({ email: emailClean });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const otpDoc = await RegisterOtp.findOne({ email: emailClean });
    if (!otpDoc) return res.status(400).json({ message: "No OTP request found. Please resend OTP." });

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await RegisterOtp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: "OTP expired. Please resend OTP." });
    }

    otpDoc.attempts = (otpDoc.attempts || 0) + 1;
    if (otpDoc.attempts > 5) {
      await RegisterOtp.deleteOne({ _id: otpDoc._id });
      return res.status(429).json({ message: "Too many OTP attempts. Please resend OTP." });
    }

    const match = hashOtp(otp) === otpDoc.otpHash;
    if (!match) {
      await otpDoc.save();
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    const passwordHash = await bcrypt.hash(pw, 12);

    // ✅ generate BSRT formatted ID AFTER OTP is verified
    const bsrtId = await nextBsrtId();

    const patient = await Patient.create({
      email: emailClean,
      passwordHash,
      firstName: fn,
      lastName: ln,
      middleName,
      suffix,
      gender,
      birthdate,
      contactNumber,
      address: String(address || "").trim(), // ✅ save if provided

      role: "patient",
      bsrtId,
      isArchived: false,
    });

    await RegisterOtp.deleteOne({ _id: otpDoc._id });

    const token = signToken(patient._id.toString(), false);
    return res.status(201).json({ token });
  } catch (err) {
    return res.status(500).json({ message: "Register failed", error: err.message });
  }
});

/* ============================================================
   GET /api/auth/me
============================================================ */
router.get("/me", requireAuth, async (req, res) => {
  const patient = await Patient.findById(req.userId).lean();
  if (!patient) return res.status(404).json({ message: "Not found" });

  const role = String(patient.role || "patient").trim().toLowerCase();

  return res.json({
    ...patient,
    isAdmin: role === "admin" || role === "superadmin",
    isSuperAdmin: role === "superadmin",
  });
});

/* ============================================================
   PUT /api/auth/me
   ✅ now includes address + avatarUrl
============================================================ */
router.put("/me", requireAuth, async (req, res) => {
  try {
    const allowed = [
      "firstName",
      "middleName",
      "lastName",
      "suffix",
      "gender",
      "birthdate",
      "contactNumber",
      "avatarUrl",
      "address", // ✅ FIX for Home Address saving
    ];

    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (update.birthdate) {
      const d = new Date(update.birthdate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: "Invalid birthdate" });
      }
      update.birthdate = d;
    }

    // Normalize strings
    if (update.firstName !== undefined) update.firstName = String(update.firstName || "").trim();
    if (update.middleName !== undefined) update.middleName = String(update.middleName || "").trim();
    if (update.lastName !== undefined) update.lastName = String(update.lastName || "").trim();
    if (update.suffix !== undefined) update.suffix = String(update.suffix || "").trim();
    if (update.contactNumber !== undefined) update.contactNumber = String(update.contactNumber || "").trim();
    if (update.avatarUrl !== undefined) update.avatarUrl = String(update.avatarUrl || "").trim();
    if (update.address !== undefined) update.address = String(update.address || "").trim();

    const patient = await Patient.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!patient) return res.status(404).json({ message: "Not found" });
    return res.json(patient);
  } catch (err) {
    return res.status(500).json({ message: "Update failed", error: err.message });
  }
});

module.exports = router;