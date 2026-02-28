// backend/routes/configRoutes.js
const express = require("express");
const router = express.Router();

router.get("/public", (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const loginBgPublicId = process.env.LOGIN_BG_PUBLIC_ID || "background_azdowt";

  if (!cloudName) {
    return res.status(500).json({ message: "CLOUDINARY_CLOUD_NAME is not set in backend/.env" });
  }

  // Optimized delivery URL (no API key needed because it's public delivery)
  const loginBgUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_1920/${loginBgPublicId}.png`;

  return res.json({ loginBgUrl });
});

module.exports = router;
