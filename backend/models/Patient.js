const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
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
          // Allow empty birthdate
          if (!v) return true;
          // Must not be in the future
          return v <= new Date();
        },
        message: "Birthdate cannot be in the future.",
      },
    },

    contactNumber: { type: String, trim: true, default: "" },

    // Store only the URL (recommended). Upload the file to Cloudinary/S3/etc.
    avatarUrl: { type: String, trim: true, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, required: true, select: false },

    // ===== Login OTP fields (2-step login) =====
    loginOtpHash: { type: String, select: false },
    loginOtpExpiresAt: { type: Date, select: false },
    loginOtpLastSentAt: { type: Date, select: false },
    loginOtpAttempts: { type: Number, default: 0, select: false },
    // ==========================================

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
