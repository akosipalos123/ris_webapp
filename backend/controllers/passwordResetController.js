// backend/controllers/passwordResetController.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Patient = require("../models/Patient"); // ✅ IMPORTANT: use Patient, not User
const { sendPasswordResetEmail } = require("../utils/mailer");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function pickFirstUrl(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return (
    s
      .split(",")
      .map((x) => String(x).trim())
      .filter(Boolean)[0] || ""
  );
}

function getFrontendBaseUrl(req) {
  const envUrl = pickFirstUrl(process.env.FRONTEND_URL || process.env.CLIENT_URL);
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = String(req.get("origin") || "").trim();
  if (origin) return origin.replace(/\/+$/, "");

  return "";
}

async function forgotPassword(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();

  // Generic response (prevents account enumeration)
  const genericMsg =
    "If an account exists for that email, a password reset link has been sent.";

  try {
    if (!email) return res.status(200).json({ message: genericMsg });

    const patient = await Patient.findOne({
      email,
      isArchived: { $ne: true },
      isActive: { $ne: false }, // match your login rules
    }).select("_id email");

    if (!patient) return res.status(200).json({ message: genericMsg });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);

    const ttlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await Patient.updateOne(
      { _id: patient._id },
      { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
    );

    const base = getFrontendBaseUrl(req);
    if (!base) {
      await Patient.updateOne(
        { _id: patient._id },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
      );
      return res.status(200).json({ message: genericMsg });
    }

    const resetLink =
      `${base}/reset-password?token=${encodeURIComponent(rawToken)}` +
      `&email=${encodeURIComponent(email)}`;

    try {
      await sendPasswordResetEmail(email, resetLink, expiresAt);
    } catch (mailErr) {
      console.error("[FORGOT PASSWORD] email send failed:", mailErr?.message || mailErr);

      await Patient.updateOne(
        { _id: patient._id },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
      );
    }

    return res.status(200).json({ message: genericMsg });
  } catch (err) {
    console.error("[FORGOT PASSWORD] handler error:", err?.message || err);
    return res.status(200).json({ message: genericMsg });
  }
}

async function resetPassword(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!email || !token) {
      return res.status(400).json({ message: "Invalid reset request." });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const tokenHash = sha256Hex(token);

    const patient = await Patient.findOne({
      email,
      isArchived: { $ne: true },
      isActive: { $ne: false },
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("_id");

    if (!patient) {
      return res.status(400).json({ message: "Reset token is invalid or expired." });
    }

    const hashed = await bcrypt.hash(password, 12);

    const updateRes = await Patient.updateOne(
      { _id: patient._id },
      {
        $set: { passwordHash: hashed },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      }
    );

    const modified = updateRes?.modifiedCount ?? updateRes?.nModified ?? 0;
    if (!modified) {
      return res.status(500).json({ message: "Password update failed. Please try again." });
    }

    return res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error("[RESET PASSWORD] handler error:", err?.message || err);
    return res.status(500).json({ message: "Server error resetting password." });
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
};