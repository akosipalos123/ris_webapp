// backend/models/LoginOtp.js
const mongoose = require("mongoose");

const LoginOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

// ✅ TTL index: MongoDB auto-deletes document when expiresAt is reached
LoginOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("LoginOtp", LoginOtpSchema);