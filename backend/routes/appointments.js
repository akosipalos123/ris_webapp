// backend/routes/appointments.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");

const router = express.Router();

// Middleware: require login (PATIENT token)
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Block admin JWT from patient-only routes (admin tokens have typ:"admin")
    if (payload?.typ && String(payload.typ).toLowerCase() === "admin") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    req.userId = payload.sub;

    // ✅ Prevent bad writes / broken queries
    if (!mongoose.Types.ObjectId.isValid(String(req.userId))) {
      return res.status(401).json({ message: "Invalid token subject" });
    }

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Dropdown-controlled procedures (must match frontend <option value="..."> exactly)
 */
const ALLOWED_PROCEDURES = ["X-Ray"];

/**
 * Daily slot limits per procedure (central across all patients)
 * Key must match the exact ALLOWED_PROCEDURES value.
 */
const DAILY_LIMITS = {
  "X-Ray": 15,
};

/**
 * Statuses that consume capacity.
 * Recommended: reserve slot while Pending to prevent oversubmission.
 */
const COUNT_STATUSES_FOR_CAPACITY = ["Pending", "Approved"];

/**
 * Allowed appointment statuses (keep in sync with model)
 */
const ALLOWED_STATUSES = ["Pending", "Approved", "Cancelled", "Completed", "Rejected"];

function isValidYMD(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const dt = new Date(y, m - 1, d);
  return !Number.isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isPastDate(y, m, d) {
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return dt < today;
}

function fmtYMD(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Helper: make patientId matching robust whether stored as ObjectId or string
 */
function patientIdQuery(userId) {
  const uid = String(userId || "").trim();
  const ids = [uid];
  if (mongoose.Types.ObjectId.isValid(uid)) ids.push(new mongoose.Types.ObjectId(uid));
  return { $in: ids };
}

// GET /api/appointments/availability?procedure=X-Ray&date=YYYY-MM-DD
router.get("/availability", requireAuth, async (req, res) => {
  try {
    const { procedure, date } = req.query;

    if (!procedure || !date) {
      return res.status(400).json({ message: "procedure and date are required" });
    }

    if (!ALLOWED_PROCEDURES.includes(procedure)) {
      return res.status(400).json({ message: "Invalid procedure selected" });
    }

    const [y, m, d] = String(date).split("-").map(Number);
    if (!isValidYMD(y, m, d)) {
      return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD required)" });
    }

    const limit = DAILY_LIMITS[procedure] ?? 0;

    const used = await Appointment.countDocuments({
      procedure,
      year: y,
      month: m,
      day: d,
      status: { $in: COUNT_STATUSES_FOR_CAPACITY },
    });

    const remaining = Math.max(limit - used, 0);

    return res.json({
      procedure,
      date: fmtYMD(y, m, d),
      limit,
      used,
      remaining,
    });
  } catch (err) {
    return res.status(500).json({ message: "Availability check failed", error: err.message });
  }
});

// POST /api/appointments  (submit appointment for approval)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { procedure, year, month, day } = req.body;

    if (!procedure || year === undefined || month === undefined || day === undefined) {
      return res.status(400).json({ message: "procedure, year, month, day are required" });
    }

    if (!ALLOWED_PROCEDURES.includes(procedure)) {
      return res.status(400).json({ message: "Invalid procedure selected" });
    }

    const y = Number(year);
    const m = Number(month);
    const d = Number(day);

    if (!isValidYMD(y, m, d)) {
      return res.status(400).json({ message: "Invalid date" });
    }

    if (isPastDate(y, m, d)) {
      return res.status(400).json({ message: "Appointment date cannot be in the past" });
    }

    // ✅ Always store patientId as ObjectId
    const patientObjectId = new mongoose.Types.ObjectId(String(req.userId));

    /**
     * Enforce: patient cannot submit same procedure again if active exists
     * Active = Pending or Approved
     */
    const existingActive = await Appointment.findOne({
      patientId: patientIdQuery(req.userId), // ✅ robust match for old records
      procedure,
      status: { $in: ["Pending", "Approved"] },
    }).lean();

    if (existingActive) {
      return res.status(409).json({
        message:
          `You already have an active ${procedure} appointment ` +
          `(${existingActive.status === "Pending" ? "Submitted for approval" : "Approved"}). ` +
          `You can submit again only after it is Cancelled or Completed.`,
      });
    }

    // Capacity check (central across all users)
    const limit = DAILY_LIMITS[procedure] ?? 0;
    if (limit > 0) {
      const used = await Appointment.countDocuments({
        procedure,
        year: y,
        month: m,
        day: d,
        status: { $in: COUNT_STATUSES_FOR_CAPACITY },
      });

      if (used >= limit) {
        return res.status(409).json({
          message: `No available slots left for ${procedure} on ${fmtYMD(y, m, d)}.`,
        });
      }
    }

    // Create as Pending
    const appt = await Appointment.create({
      patientId: patientObjectId, // ✅ ObjectId, consistent with schema
      procedure,
      year: y,
      month: m,
      day: d,
      status: "Pending",
    });

    return res.status(201).json(appt);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        message:
          "You already have an active appointment for this procedure. " +
          "You can submit again only after it is Cancelled or Completed.",
      });
    }

    return res.status(500).json({ message: "Submission failed", error: err.message });
  }
});

// GET /api/appointments/mine  (list my appointments)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const appts = await Appointment.find({ patientId: patientIdQuery(req.userId) }) // ✅ robust
      .sort({ year: 1, month: 1, day: 1, createdAt: -1 })
      .lean();

    return res.json(appts);
  } catch (err) {
    return res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

/**
 * GET /api/appointments/mine-filtered?status=Pending|Approved|Cancelled|Completed|Rejected
 */
router.get("/mine-filtered", requireAuth, async (req, res) => {
  try {
    const raw = String(req.query?.status || "").trim();

    const query = { patientId: patientIdQuery(req.userId) }; // ✅ robust

    if (raw) {
      if (!ALLOWED_STATUSES.includes(raw)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      query.status = raw;
    }

    const appts = await Appointment.find(query)
      .sort({ year: 1, month: 1, day: 1, createdAt: -1 })
      .lean();

    return res.json(appts);
  } catch (err) {
    return res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

/**
 * ✅ NEW: GET /api/appointments/mine-bills
 */
router.get("/mine-bills", requireAuth, async (req, res) => {
  try {
    const appts = await Appointment.find({
      patientId: patientIdQuery(req.userId),
      status: "Completed",
    })
      .sort({ completedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const bills = appts.map((a) => {
      const issuedAt = a.completedAt || a.updatedAt || a.createdAt || null;

      const procedureLabel =
        a.billing?.label || a.billingLabel || a.procedureDone || a.procedure || "—";

      const amount =
        (typeof a.billing?.amount === "number" ? a.billing.amount : undefined) ??
        (typeof a.billingAmount === "number" ? a.billingAmount : undefined) ??
        (a.billingAmount != null ? Number(a.billingAmount) : undefined) ??
        0;

      return {
        _id: a._id,
        appointmentId: a._id,
        issuedAt,
        procedure: procedureLabel,
        totalAmount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
        status: "Pending",
        receiptUrl: a.resultPdfUrl || a.resultPdf || a.resultUrl || "",
        source: "appointments",
      };
    });

    return res.json(bills);
  } catch (err) {
    return res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

/**
 * PATCH /api/appointments/:id/cancel
 * Patient cancels their own appointment.
 */
router.patch("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appt = await Appointment.findOne({
      _id: id,
      patientId: patientIdQuery(req.userId), // ✅ robust
    });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appt.status === "Completed") {
      return res.status(400).json({ message: "Completed appointments cannot be cancelled" });
    }
    if (appt.status === "Cancelled") {
      return res.status(400).json({ message: "Appointment already cancelled" });
    }

    appt.status = "Cancelled";
    await appt.save();

    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: "Cancel failed", error: err.message });
  }
});

module.exports = router;