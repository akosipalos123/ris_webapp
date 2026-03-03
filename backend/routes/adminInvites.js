// backend/routes/adminInvites.js
const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const Patient = require("../models/Patient");
const AdminInvite = require("../models/AdminInvite");
const Counter = require("../models/Counter");

const router = express.Router();

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

/* ---------------- AUTH (patient token) ---------------- */
function requirePatientAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.patientId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function requireSuperAdmin(req, res, next) {
  const p = await Patient.findById(req.patientId).lean();
  if (!p) return res.status(401).json({ message: "Not found" });

  const role = String(p.role || "").trim().toLowerCase();
  if (role !== "superadmin") return res.status(403).json({ message: "Forbidden" });

  req.patient = p;
  next();
}

async function nextAdminBsrtId() {
  const c = await Counter.findByIdAndUpdate(
    "admins",
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `BSRTADMIN${String(c.seq).padStart(8, "0")}`;
}

// POST /api/admin/invites
router.post("/", requirePatientAuth, requireSuperAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "admin").trim().toLowerCase();
    const days = Number(req.body.expiresInDays || 5);

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!["admin", "superadmin"].includes(role)) return res.status(400).json({ message: "Invalid role" });

    // ✅ avoid inviting an email that already exists in patients
    const exists = await Patient.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(1, Math.min(days, 30)) * 24 * 60 * 60 * 1000);

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = sha256(inviteToken);

    const bsrtId = await nextAdminBsrtId();

    const invite = await AdminInvite.create({
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      role,
      bsrtId,
      createdBy: req.patientId,
    });

    const baseUrl =
      (process.env.PUBLIC_APP_URL || "").trim() ||
      String(process.env.FRONTEND_URL || "").split(",")[0]?.trim() ||
      "";

    const inviteLink = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/admin-register?token=${encodeURIComponent(inviteToken)}`
      : `/admin-register?token=${encodeURIComponent(inviteToken)}`;

    return res.json({
      inviteLink,
      expiresAt: invite.expiresAt,
      role: invite.role,
      bsrtId: invite.bsrtId,
      message: "Invite generated.",
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to generate invite", error: err.message });
  }
});

// GET /api/admin/invites/verify?token=...
router.get("/verify", async (req, res) => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const tokenHash = sha256(token);
    const invite = await AdminInvite.findOne({ tokenHash }).lean();

    if (!invite) return res.status(400).json({ message: "Invite is invalid or expired." });
    if (invite.usedAt) return res.status(400).json({ message: "Invite already used." });
    if (new Date() > new Date(invite.expiresAt)) return res.status(400).json({ message: "Invite expired." });

    return res.json({
      email: invite.email,
      expiresAt: invite.expiresAt,
      role: invite.role,
      bsrtId: invite.bsrtId,
    });
  } catch (err) {
    return res.status(500).json({ message: "Verify failed", error: err.message });
  }
});

module.exports = router;