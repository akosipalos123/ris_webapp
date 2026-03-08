// backend/models/Patient.js
const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    bsrtId: { type: String, unique: true, index: true, default: "" },

    role: {
      type: String,
      enum: ["patient", "admin", "superadmin"],
      default: "patient",
      index: true,
      trim: true,
    },

    isArchived: { type: Boolean, default: false, index: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, required: true, trim: true },
    suffix: { type: String, trim: true, default: "" },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say"],
      default: "Prefer not to say",
      trim: true,
    },

    birthdate: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return v <= new Date();
        },
        message: "Birthdate cannot be in the future.",
      },
    },

    contactNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    avatarUrl: { type: String, trim: true, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, required: true, select: false },

    // ✅ ADD THESE (Forgot Password / Reset Password)
    passwordResetTokenHash: { type: String, index: true, select: false },
    passwordResetExpiresAt: { type: Date, index: true, select: false },

    // Login OTP fields
    loginOtpHash: { type: String, select: false },
    loginOtpExpiresAt: { type: Date, select: false },
    loginOtpLastSentAt: { type: Date, select: false },
    loginOtpAttempts: { type: Number, default: 0, select: false },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);