// backend/models/Appointment.js
const mongoose = require("mongoose");

const diagnosticImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: "" }, // cloudinary id if you want
    uploadedAt: { type: Date, default: Date.now },
    caption: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Billing snapshot schema (stored on appointment upon completion)
const billingSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" }, // e.g. "CHEST_ADULT"
    label: { type: String, trim: true, default: "" }, // e.g. "Chest — Adult (above 12 y.o.)"
    amount: { type: Number, default: 0, min: 0 }, // e.g. 200
    currency: { type: String, trim: true, default: "PHP" },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    procedure: { type: String, required: true, trim: true },

    year: { type: Number, required: true, min: 1900, max: 3000 },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 31 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Cancelled", "Completed", "Rejected"],
      default: "Pending",
      index: true,
    },

    // ===== Referring Physician Request Upload (Patient) =====
    referralUrl: { type: String, trim: true, default: "" },
    referralUploadedAt: { type: Date },
    // ======================================================

    // ===== Result / Completion data (Admin fills this) =====
    resultPdfUrl: { type: String, trim: true, default: "" },
    resultNotes: { type: String, trim: true, default: "" },

    // ✅ Billing snapshot saved at completion time
    billing: { type: billingSchema, default: () => ({}) },

    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    // ======================================================

    // ===== Diagnostic Images + Report Fields (Admin fills this) =====
    radiographType: { type: String, trim: true, default: "" }, // e.g. "Chest PA", "Skull AP"
    findings: { type: String, trim: true, default: "" },
    impression: { type: String, trim: true, default: "" },
    interpretation: { type: String, trim: true, default: "" },

    diagnosticImages: { type: [diagnosticImageSchema], default: [] },
    // ======================================================
  },
  { timestamps: true }
);

/**
 * Enforce: only ONE ACTIVE appointment per patient per procedure.
 * Active = Pending or Approved
 */
appointmentSchema.index(
  { patientId: 1, procedure: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["Pending", "Approved"] } },
  }
);

appointmentSchema.index({ procedure: 1, year: 1, month: 1, day: 1, status: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);