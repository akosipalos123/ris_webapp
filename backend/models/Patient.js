// backend/models/Patient.js
const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // ✅ human-friendly ID for all users (patients/admins/superadmins)
    bsrtId: { type: String, unique: true, index: true, default: "" },

    // ✅ single-table RBAC (patient/admin/superadmin)
    role: {
      type: String,
      enum: ["patient", "admin", "superadmin"],
      default: "patient",
      index: true,
      trim: true,
    },

    // ✅ for admin management (archive/restore)
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
          if (!v) return true; // allow empty
          return v <= new Date(); // not in the future
        },
        message: "Birthdate cannot be in the future.",
      },
    },

    contactNumber: { type: String, trim: true, default: "" },

    // ✅ NEW: Home Address (this is why it wasn't saving)
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