// backend/routes/bills.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Bill = require("../models/Bill");

const router = express.Router();

// Middleware: require login
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
 * GET /api/bills/mine
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

    const bills = await Bill.find(query)
      .populate("appointmentId", "procedure year month day status")
      .sort({ issuedAt: -1, createdAt: -1 })
      .lean();

    return res.json(bills);
  } catch (err) {
    return res.status(500).json({ message: "Fetch bills failed", error: err.message });
  }
});

module.exports = router;
