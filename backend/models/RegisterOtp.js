// backend/models/RegisterOtp.js
const mongoose = require("mongoose");

const RegisterOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-delete expired OTP docs (Mongo TTL)
RegisterOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RegisterOtp", RegisterOtpSchema);
