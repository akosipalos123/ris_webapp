// backend/models/DiagnosticImage.js
const mongoose = require("mongoose");

const diagnosticImageItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    label: { type: String, trim: true, default: "" }, // e.g. "Chest PA"
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const diagnosticImageSchema = new mongoose.Schema(
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
      unique: true, // one gallery doc per appointment
    },
    procedure: { type: String, trim: true, default: "" },
    items: { type: [diagnosticImageItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiagnosticImage", diagnosticImageSchema);
