// backend/routes/report.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const Bill = require("../models/Bill");
const DiagnosticImage = require("../models/DiagnosticImage");

const router = express.Router();

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function formatYMD(a) {
  const mm = String(a.month).padStart(2, "0");
  const dd = String(a.day).padStart(2, "0");
  return `${a.year}-${mm}-${dd}`;
}

/**
 * GET /api/report/:appointmentId
 * Patient can only access their own appointment report.
 */
router.get("/:appointmentId", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.appointmentId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid appointmentId" });
    }

    const appt = await Appointment.findOne({ _id: id, patientId: req.userId }).lean();
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const patient = await Patient.findById(req.userId).lean();

    const bill = await Bill.findOne({ appointmentId: appt._id, patientId: req.userId }).lean();

    const images = await DiagnosticImage.find({
      appointmentId: appt._id,
      patientId: req.userId,
    })
      .sort({ uploadedAt: -1 })
      .lean();

    return res.json({
      appointment: { ...appt, date: formatYMD(appt) },
      patient: patient
        ? {
            _id: patient._id,
            firstName: patient.firstName,
            middleName: patient.middleName,
            lastName: patient.lastName,
            suffix: patient.suffix,
            email: patient.email,
            contactNumber: patient.contactNumber,
            gender: patient.gender,
            birthdate: patient.birthdate,
          }
        : null,
      bill: bill || null,
      images: images || [],
      result: {
        resultPdfUrl: appt.resultPdfUrl || "",
        resultNotes: appt.resultNotes || "",
        completedAt: appt.completedAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Report fetch failed", error: err.message });
  }
});

module.exports = router;
