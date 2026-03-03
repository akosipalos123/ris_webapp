// backend/routes/adminAuth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Patient = require("../models/Patient");
const AdminInvite = require("../models/AdminInvite");
const Counter = require("../models/Counter");
const LoginOtp = require("../models/LoginOtp");

const router = express.Router();

function signAdminToken(patientId, role, keepSignedIn = false) {
  const exp = keepSignedIn
    ? process.env.JWT_EXPIRES_IN_ADMIN_LONG || "30d"
    : process.env.JWT_EXPIRES_IN_ADMIN || "7d";

  return jwt.sign({ sub: patientId, role, typ: "admin" }, process.env.JWT_SECRET, { expiresIn: exp });
}

function signAdminOtpToken(email, ttlMinutes) {
  const expSeconds = Math.max(60, Number(ttlMinutes || 10) * 60); // min 60s
  return jwt.sign({ email, typ: "admin_otp" }, process.env.JWT_SECRET, { expiresIn: expSeconds });
}

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

// Fallback (if older invites don’t have bsrtId)
async function nextAdminBsrtId() {
  const c = await Counter.findByIdAndUpdate(
    "admins",
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `BSRTADMIN${String(c.seq).padStart(8, "0")}`;
}

/* ---------------- adminToken auth ---------------- */
function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.typ !== "admin") return res.status(401).json({ message: "Invalid token type" });
    req.adminId = payload.sub;
    req.adminRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * ✅ Replace this with your actual email/SMS sender.
 * For now, it logs OTP in dev only.
 */
async function deliverAdminOtp(email, otp) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ADMIN OTP] ${email} -> ${otp}`);
  }
  // TODO: wire your email sender here
  // e.g. await sendOtpEmail(email, otp);
}

/**
 * POST /api/admin/auth/login
 * body: { email, password, keepSignedIn? }
 *
 * ✅ Step 1: validate credentials, send OTP, return otpToken
 */
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const keepSignedIn = !!req.body.keepSignedIn;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const p = await Patient.findOne({ email }).select("+passwordHash");
    if (!p) return res.status(401).json({ message: "Invalid credentials" });

    const role = String(p.role || "").trim().toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return res.status(403).json({ message: "This account is not an admin." });
    }

    if (p.isArchived) return res.status(403).json({ message: "Account archived" });
    if (p.isActive === false) return res.status(403).json({ message: "Account disabled" });

    const ok = await bcrypt.compare(password, p.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // OTP settings
    const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
    const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
    const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);

    // Throttle resends
    const existing = await LoginOtp.findOne({ email }).lean();
    if (existing?.lastSentAt) {
      const secondsSince = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
      if (secondsSince < OTP_RESEND_SECONDS) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(OTP_RESEND_SECONDS - secondsSince)}s before requesting a new OTP.`,
        });
      }
    }

    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // One OTP per email (since email is unique)
    await LoginOtp.findOneAndUpdate(
      { email },
      {
        otpHash: sha256(otp),
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await deliverAdminOtp(email, otp);

    const otpToken = signAdminOtpToken(email, OTP_TTL_MINUTES);

    return res.json({
      otpRequired: true,
      otpToken,
      message: "OTP sent. Please check your email.",
      keepSignedIn, // optional echo
    });
  } catch (err) {
    return res.status(500).json({ message: "Admin login failed", error: err.message });
  }
});

/**
 * POST /api/admin/auth/verify-otp
 * body: { otpToken, otp, keepSignedIn? }
 *
 * ✅ Step 2: verify OTP then issue admin JWT
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const otpToken = String(req.body.otpToken || "").trim();
    const otp = String(req.body.otp || "").replace(/\D/g, "").slice(0, 6);
    const keepSignedIn = !!req.body.keepSignedIn;

    if (!otpToken || !otp) {
      return res.status(400).json({ message: "otpToken and otp are required" });
    }
    if (otp.length !== 6) {
      return res.status(400).json({ message: "OTP must be 6 digits" });
    }

    let payload;
    try {
      payload = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired OTP token" });
    }

    if (payload?.typ !== "admin_otp" || !payload?.email) {
      return res.status(401).json({ message: "Invalid OTP token type" });
    }

    const email = String(payload.email).trim().toLowerCase();

    const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

    const rec = await LoginOtp.findOne({ email });
    if (!rec) return res.status(400).json({ message: "OTP not found or expired" });

    if (new Date() > new Date(rec.expiresAt)) {
      await LoginOtp.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    if (rec.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many attempts. Please request a new OTP." });
    }

    rec.attempts += 1;

    const ok = sha256(otp) === rec.otpHash;
    if (!ok) {
      await rec.save();
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // consume OTP
    await LoginOtp.deleteOne({ email });

    const p = await Patient.findOne({ email }).lean();
    if (!p) return res.status(404).json({ message: "Not found" });

    const role = String(p.role || "").trim().toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return res.status(403).json({ message: "This account is not an admin." });
    }
    if (p.isArchived) return res.status(403).json({ message: "Account archived" });
    if (p.isActive === false) return res.status(403).json({ message: "Account disabled" });

    const token = signAdminToken(String(p._id), role, keepSignedIn);

    return res.json({
      token,
      user: {
        id: p._id,
        email: p.email,
        role,
        firstName: p.firstName,
        lastName: p.lastName,
        bsrtId: p.bsrtId || "",
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "OTP verification failed", error: err.message });
  }
});

/**
 * POST /api/admin/auth/register
 * body: { token, firstName, lastName, password }
 *
 * ✅ role + bsrtId are taken from the invite (server-controlled)
 */
router.post("/register", async (req, res) => {
  try {
    const inviteToken = String(req.body.token || req.body.inviteToken || "").trim();
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const password = String(req.body.password || "");

    if (!inviteToken) return res.status(400).json({ message: "token is required" });
    if (!firstName || !lastName || !password) {
      return res.status(400).json({ message: "firstName, lastName, and password are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });

    const tokenHash = sha256(inviteToken);
    const invite = await AdminInvite.findOne({ tokenHash });

    if (!invite) return res.status(400).json({ message: "Invalid or expired invite." });
    if (invite.usedAt) return res.status(400).json({ message: "Invite already used." });
    if (new Date() > new Date(invite.expiresAt)) return res.status(400).json({ message: "Invite expired." });

    const email = String(invite.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Invite email missing." });

    const role = ["admin", "superadmin"].includes(String(invite.role)) ? String(invite.role) : "admin";
    const bsrtId = invite.bsrtId || (await nextAdminBsrtId());

    const exists = await Patient.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);

    const p = await Patient.create({
      email,
      firstName,
      lastName,
      passwordHash,
      role,
      bsrtId,
      isArchived: false,
      isActive: true,
    });

    invite.usedAt = new Date();
    await invite.save();

    const token = signAdminToken(p._id.toString(), role, false);
    return res.status(201).json({
      token,
      user: {
        id: p._id,
        email: p.email,
        role,
        firstName: p.firstName,
        lastName: p.lastName,
        bsrtId: p.bsrtId || "",
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Admin register failed", error: err.message });
  }
});

/**
 * GET /api/admin/auth/me
 */
router.get("/me", requireAdminAuth, async (req, res) => {
  const p = await Patient.findById(req.adminId).lean();
  if (!p) return res.status(404).json({ message: "Not found" });

  return res.json({
    ...p,
    isSuperAdmin: String(p.role || "").toLowerCase() === "superadmin",
    bsrtId: p.bsrtId || "",
  });
});

module.exports = router;