// backend/routes/radiographs.js
const express = require("express");
const jwt = require("jsonwebtoken");

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

// You can expand this anytime. Used by UI and stored in DiagnosticImage.radiographType
const RADIOGRAPH_TYPES = [
  "Chest PA",
  "Chest AP",
  "Skull",
  "Spine (Cervical)",
  "Spine (Thoracic)",
  "Spine (Lumbar)",
  "Abdomen",
  "Pelvis",
  "Upper Extremity (Hand/Wrist/Arm)",
  "Lower Extremity (Foot/Ankle/Leg)",
];

router.get("/", requireAuth, async (req, res) => {
  return res.json({ types: RADIOGRAPH_TYPES });
});

module.exports = router;
