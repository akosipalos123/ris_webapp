// backend/models/DiagnosticResult.js
const mongoose = require("mongoose");

const diagnosticResultSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
      unique: true, // one result per appointment
    },
    procedure: { type: String, trim: true, default: "" },

    // structured fields for your "Report"
    radiographType: { type: String, trim: true, default: "" }, // e.g. "Chest PA"
    impression: { type: String, trim: true, default: "" },
    findings: { type: String, trim: true, default: "" },
    interpretation: { type: String, trim: true, default: "" },

    referringPhysician: { type: String, trim: true, default: "" },
    radiologist: { type: String, trim: true, default: "" },

    // optional: store a generated printable report PDF too (separate from Appointment.resultPdfUrl)
    reportPdfUrl: { type: String, trim: true, default: "" },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiagnosticResult", diagnosticResultSchema);
