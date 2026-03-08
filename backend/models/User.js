// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["patient", "admin", "superadmin"],
      default: "patient",
      index: true,
    },

    // ✅ NEW: archive flag (used by Super Admin Panel)
    isArchived: { type: Boolean, default: false, index: true },

    // ✅ NEW: Forgot Password / Reset Password fields (safe add)
    passwordResetTokenHash: { type: String, index: true },
    passwordResetExpiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);