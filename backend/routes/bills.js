// backend/routes/bills.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Appointment = require("../models/Appointment"); // ✅ make sure this exists

const router = express.Router();

// Middleware: require login
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

// ✅ Create a stub Bill for an Approved appointment (if missing)
async function ensureBillForApprovedAppointment(patientObjId, appt) {
  if (!appt?._id) return;

  const apptId = appt._id;
  const proc = String(appt.procedure || "").trim();

  // Only create if missing; one bill per appointment enforced by unique index
  await Bill.updateOne(
    { appointmentId: apptId },
    {
      $setOnInsert: {
        patientId: patientObjId,
        appointmentId: apptId,
        procedure: proc,
        billing: { label: proc, amount: 0, currency: "PHP" }, // amount can be updated later
        totalAmount: 0,
        currency: "PHP",
        status: "Unpaid",
        issuedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * GET /api/bills/mine
 * Optional: ?appointmentId=<id>
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const patientIdStr = String(req.userId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(patientIdStr)) {
      return res.status(401).json({ message: "Invalid token subject" });
    }
    const patientObjId = new mongoose.Types.ObjectId(patientIdStr);

    const appointmentId = String(req.query?.appointmentId || "").trim();

    // If they request a specific appointmentId, also auto-create bill (if Approved)
    if (appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ message: "Invalid appointmentId" });
      }

      const appt = await Appointment.findOne({
        _id: new mongoose.Types.ObjectId(appointmentId),
        patientId: patientObjId,
      })
        .select("_id procedure status")
        .lean();

      if (appt && String(appt.status || "") === "Approved") {
        await ensureBillForApprovedAppointment(patientObjId, appt);
      }

      const bills = await Bill.find({ patientId: patientObjId, appointmentId: appointmentId })
        .populate("appointmentId", "procedure year month day status")
        .sort({ issuedAt: -1, createdAt: -1 })
        .lean();

      return res.json(bills);
    }

    // ✅ Backfill: create bills for ALL Approved appointments missing a bill
    const approvedAppointments = await Appointment.find({
      patientId: patientObjId,
      status: "Approved",
    })
      .select("_id procedure status")
      .lean();

    if (approvedAppointments.length) {
      const apptIds = approvedAppointments.map((a) => a._id);

      const existingBills = await Bill.find({ appointmentId: { $in: apptIds } })
        .select("appointmentId")
        .lean();

      const existingSet = new Set(existingBills.map((b) => String(b.appointmentId)));

      const missing = approvedAppointments.filter((a) => !existingSet.has(String(a._id)));

      if (missing.length) {
        await Bill.bulkWrite(
          missing.map((a) => ({
            updateOne: {
              filter: { appointmentId: a._id },
              update: {
                $setOnInsert: {
                  patientId: patientObjId,
                  appointmentId: a._id,
                  procedure: String(a.procedure || "").trim(),
                  billing: { label: String(a.procedure || "").trim(), amount: 0, currency: "PHP" },
                  totalAmount: 0,
                  currency: "PHP",
                  status: "Unpaid",
                  issuedAt: new Date(),
                },
              },
              upsert: true,
            },
          }))
        );
      }
    }

    // Return bills (now includes newly created stubs)
    const bills = await Bill.find({ patientId: patientObjId })
      .populate("appointmentId", "procedure year month day status")
      .sort({ issuedAt: -1, createdAt: -1 })
      .lean();

    return res.json(bills);
  } catch (err) {
    return res.status(500).json({ message: "Fetch bills failed", error: err.message });
  }
});

module.exports = router;