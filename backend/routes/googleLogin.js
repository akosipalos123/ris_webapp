// backend/routes/googleLogin.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const Patient = require("../models/Patient");

const router = express.Router();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function signPatientToken(patientId, keepSignedIn = false) {
  const exp = keepSignedIn
    ? process.env.JWT_EXPIRES_IN_LONG || process.env.JWT_EXPIRES_IN || "30d"
    : process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ sub: patientId }, process.env.JWT_SECRET, { expiresIn: exp });
}

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const keepSignedIn = !!req.body.keepSignedIn;
    const credential = String(req.body.credential || "").trim();

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Server missing GOOGLE_CLIENT_ID" });
    }

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const p = ticket.getPayload() || {};
    const email = String(p.email || "").trim().toLowerCase();
    const emailVerified =
      p.email_verified === true || String(p.email_verified) === "true";
    const picture = String(p.picture || "").trim();

    if (!email || !emailVerified) {
      return res.status(401).json({ message: "Google email not verified." });
    }

    // ✅ Only allow if patient exists and active
    const patient = await Patient.findOne({ email });
    if (!patient || !patient.isActive || patient.isArchived) {
      return res.status(404).json({
        message: "No patient account found for this Google email. Please register first.",
      });
    }

    // Optional: set avatarUrl once (doesn't overwrite)
    if (!patient.avatarUrl && picture) {
      try {
        patient.avatarUrl = picture;
        await patient.save();
      } catch {
        // ignore avatar update failure
      }
    }

    const token = signPatientToken(patient._id.toString(), keepSignedIn);
    return res.json({ token });
  } catch (err) {
    return res.status(401).json({
      message: "Google login failed.",
      error: err.message,
    });
  }
});

module.exports = router;