// backend/models/AdminInvite.js
const mongoose = require("mongoose");

const adminInviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },

    // ✅ remove index:true here (TTL index below already creates an index)
    expiresAt: { type: Date, required: true },

    usedAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// TTL: auto-delete after expiresAt
adminInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AdminInvite", adminInviteSchema);