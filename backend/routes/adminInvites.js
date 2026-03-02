// backend/routes/adminInvites.js
const express = require("express");
const crypto = require("crypto");

const AdminInvite = require("../models/AdminInvite");
const { requireSuperAdmin } = require("../middleware/requireSuperAdmin");
const { sendAdminInviteEmail } = require("../utils/mailer");

const router = express.Router();

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const expiresInDaysRaw = Number(req.body?.expiresInDays ?? 5);
    const expiresInDays = Number.isFinite(expiresInDaysRaw)
      ? Math.max(1, Math.min(30, expiresInDaysRaw))
      : 5;

    if (!email) return res.status(400).json({ message: "email is required" });
    if (!isValidEmail(email)) return res.status(400).json({ message: "Invalid email format" });

    // Clear previous unused invites for same email
    await AdminInvite.deleteMany({ email, usedAt: null });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await AdminInvite.create({
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      // createdBy: req.superAdmin?.id, // optional (if you want audit)
    });

    const frontend = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const acceptPath = process.env.ADMIN_INVITE_ACCEPT_PATH || "/admin/register";
    const inviteLink = `${frontend}${acceptPath}?token=${encodeURIComponent(token)}`;

    // ✅ Send email
    let emailSent = true;
    try {
      await sendAdminInviteEmail(email, inviteLink, expiresAt);
    } catch (e) {
      emailSent = false;
      // Do NOT fail the whole request — still return the link so you can copy it
      console.error("Invite email failed:", e?.message || e);
    }

    return res.json({
      inviteLink,
      expiresAt,
      emailSent,
      message: emailSent
        ? "Invite created and email sent."
        : "Invite created but email failed to send. Copy the link manually.",
    });
  } catch (err) {
    return res.status(500).json({ message: "Create invite failed", error: err.message });
  }
});

// Optional verification endpoint (used by AdminRegister page)
router.get("/verify", async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).json({ message: "token is required" });

    const tokenHash = sha256(token);
    const doc = await AdminInvite.findOne({ tokenHash }).lean();
    if (!doc) return res.status(404).json({ message: "Invite not found" });

    if (doc.usedAt) return res.status(400).json({ message: "Invite already used" });
    if (new Date() > new Date(doc.expiresAt)) return res.status(400).json({ message: "Invite expired" });

    return res.json({ email: doc.email, expiresAt: doc.expiresAt });
  } catch (err) {
    return res.status(500).json({ message: "Verify failed", error: err.message });
  }
});

module.exports = router;