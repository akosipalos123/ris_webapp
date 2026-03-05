// backend/routes/passwordResetRoutes.js
const express = require("express");
const router = express.Router();

const {
  forgotPassword,
  resetPassword,
} = require("../controllers/passwordResetController");

// ✅ debug wrapper (no change to controller functions)
function logRoute(name) {
  return (req, res, next) => {
    console.log(`[RESET ROUTES] ${name} hit`, {
      method: req.method,
      path: req.originalUrl,
      body: req.body,
    });
    next();
  };
}

router.post("/forgot-password", logRoute("forgot-password"), forgotPassword);
router.post("/reset-password", logRoute("reset-password"), resetPassword);

module.exports = router;