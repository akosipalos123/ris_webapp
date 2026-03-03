// backend/models/AdminInvite.js
const mongoose = require("mongoose");

const adminInviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },

    // TTL field
    expiresAt: { type: Date, required: true },

    usedAt: { type: Date, default: null, index: true },

    // ✅ Option A: creator is a Patient
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },

    // ✅ NEW: role reserved on invite
    role: { type: String, enum: ["admin", "superadmin"], default: "admin", index: true },

    // ✅ NEW: reserved BSRT Admin ID for the invited admin
    bsrtId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// TTL: auto-delete after expiresAt
adminInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AdminInvite", adminInviteSchema);