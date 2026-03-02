// backend/routes/adminAuth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Patient = require("../models/Patient");
const AdminInvite = require("../models/AdminInvite");
const { isSuperAdminEmail } = require("../utils/admin");
const { requireAdminAuth } = require("../middleware/adminAuth");

const router = express.Router();

function signAdminToken(userId, role, keepSignedIn = false) {
  const exp = keepSignedIn
    ? process.env.JWT_EXPIRES_IN_ADMIN_LONG || "30d"
    : process.env.JWT_EXPIRES_IN_ADMIN || "7d";

  return jwt.sign({ sub: userId, role, typ: "admin" }, process.env.JWT_SECRET, { expiresIn: exp });
}

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

/**
 * POST /api/admin/auth/login
 * body: { email, password, keepSignedIn? }
 */
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const keepSignedIn = !!req.body.keepSignedIn;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ env-based superadmin override
    if (isSuperAdminEmail(email) && user.role !== "superadmin") {
      user.role = "superadmin";
      await user.save();
    }

    if (!["admin", "superadmin"].includes(user.role)) {
      return res.status(403).json({ message: "This account is not an admin." });
    }

    const token = signAdminToken(user._id.toString(), user.role, keepSignedIn);
    return res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (err) {
    return res.status(500).json({ message: "Admin login failed", error: err.message });
  }
});

/**
 * POST /api/admin/auth/register
 * Invite-based admin registration (NO OTP for now)
 * body: { inviteToken, email, firstName, lastName, password }
 */
router.post("/register", async (req, res) => {
  try {
    const inviteToken = String(req.body.inviteToken || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const password = String(req.body.password || "");

    if (!inviteToken || !email) return res.status(400).json({ message: "inviteToken and email are required" });
    if (!firstName || !lastName || !password) {
      return res.status(400).json({ message: "firstName, lastName, and password are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });

    const tokenHash = sha256(inviteToken);
    const invite = await AdminInvite.findOne({ email, tokenHash });

    if (!invite) return res.status(400).json({ message: "Invalid or expired invite." });
    if (invite.usedAt) return res.status(400).json({ message: "Invite already used." });
    if (new Date() > new Date(invite.expiresAt)) return res.status(400).json({ message: "Invite expired." });

    // optional: prevent admin email from being a patient email (recommended to avoid confusion)
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) return res.status(409).json({ message: "Email is already registered as a patient." });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: "Email is already registered as an admin." });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      firstName,
      lastName,
      passwordHash,
      role: "admin",
    });

    invite.usedAt = new Date();
    await invite.save();

    const token = signAdminToken(user._id.toString(), user.role, false);
    return res.status(201).json({
      token,
      user: { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (err) {
    return res.status(500).json({ message: "Admin register failed", error: err.message });
  }
});

/**
 * GET /api/admin/auth/me
 */
router.get("/me", requireAdminAuth, async (req, res) => {
  const user = await User.findById(req.adminId).lean();
  if (!user) return res.status(404).json({ message: "Not found" });
  return res.json({ ...user, isSuperAdmin: user.role === "superadmin" });
});

module.exports = router;