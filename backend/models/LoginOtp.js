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

module.exports = mongoose.model("LoginOtp", LoginOtpSchema);