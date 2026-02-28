// backend/routes/diagnosticImages.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const DiagnosticImage = require("../models/DiagnosticImage");

const router = express.Router();

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

/**
 * GET /api/diagnostic-images/mine
 * Optional: ?appointmentId=<id>
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const query = { patientId: req.userId };

    const appointmentId = String(req.query?.appointmentId || "").trim();
    if (appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ message: "Invalid appointmentId" });
      }
      query.appointmentId = appointmentId;
    }

    const images = await DiagnosticImage.find(query)
      .sort({ uploadedAt: -1, createdAt: -1 })
      .lean();

    return res.json(images);
  } catch (err) {
    return res.status(500).json({ message: "Fetch diagnostic images failed", error: err.message });
  }
});

module.exports = router;
