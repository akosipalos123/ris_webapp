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
 * ─────────────────────────────────────────────────────────────
 * PROCEDURE HANDLING (fixes "Invalid procedure selected")
 * ─────────────────────────────────────────────────────────────
 *
 * Problem: frontend sends labels like "Chest — Adult (above 12 y.o.)"
 * but backend was strict-matching only "X-Ray".
 *
 * Fix: normalize/standardize procedure strings and:
 *  - allow any procedure by default
 *  - still enforce per-procedure limits when configured
 *
 * Optional strict mode:
 *   STRICT_PROCEDURES=true  -> only allow keys in RAW_DAILY_LIMITS
 */

// If a procedure is not in RAW_DAILY_LIMITS, it uses this default.
const DEFAULT_DAILY_LIMIT = Number(process.env.DEFAULT_DAILY_LIMIT || 15);

// If true: only allow procedures in RAW_DAILY_LIMITS
const STRICT_PROCEDURES = String(process.env.STRICT_PROCEDURES || "").toLowerCase() === "true";

/**
 * Daily slot limits per procedure (central across all patients)
 * Add your UI labels here if you want per-procedure limits.
 */
const RAW_DAILY_LIMITS = {
  "X-Ray": 15,
  // Example (optional):
  // "Chest - Adult (above 12 y.o.)": 15,
  // "Chest - Pedia (below 12 y.o.)": 10,
};

// Statuses that consume capacity.
const COUNT_STATUSES_FOR_CAPACITY = ["Pending", "Approved"];

// Allowed appointment statuses (keep in sync with model)
const ALLOWED_STATUSES = ["Pending", "Approved", "Cancelled", "Completed", "Rejected"];

// Convert fancy dashes to "-" and normalize spacing (but keep readable label)
function standardizeProcedureLabel(input) {
  return String(input || "")
    .normalize("NFKC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-") // hyphen/en/em/minus -> "-"
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lowercased key used for matching
function normalizeProcedureKey(input) {
  return standardizeProcedureLabel(input).toLowerCase();
}

// Build an index of known procedures (for limits + optional strict validation)
const LIMITS_INDEX = new Map(); // normalizedKey -> { label, limit }
for (const [label, limit] of Object.entries(RAW_DAILY_LIMITS)) {
  const std = standardizeProcedureLabel(label);
  LIMITS_INDEX.set(normalizeProcedureKey(std), {
    label: std,
    limit: Number(limit),
  });
}

function resolveProcedure(input) {
  const std = standardizeProcedureLabel(input);
  if (!std) {
    return { ok: false, message: "procedure is required" };
  }

  const key = normalizeProcedureKey(std);
  const matched = LIMITS_INDEX.get(key);

  if (STRICT_PROCEDURES && !matched) {
    return { ok: false, message: "Invalid procedure selected" };
  }

  // If known, use canonical label + configured limit; else fallback limit
  const label = matched?.label ?? std;
  const limit = Number.isFinite(matched?.limit) ? matched.limit : DEFAULT_DAILY_LIMIT;

  return { ok: true, label, limit };
}

/**
 * When querying old records, match both:
 *  - raw incoming label
 *  - standardized label
 *  - em-dash version of standardized label (covers older stored values)
 */
function procedureVariantsForQuery(input) {
  const raw = String(input || "").trim();
  const std = standardizeProcedureLabel(raw);

  const set = new Set();
  if (raw) set.add(raw);
  if (std) set.add(std);

  // Add em-dash version too (for older stored values)
  if (std) set.add(std.replace(/ - /g, " — "));

  return Array.from(set).filter(Boolean);
}

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

// GET /api/appointments/availability?procedure=...&date=YYYY-MM-DD
router.get("/availability", requireAuth, async (req, res) => {
  try {
    const { procedure, date } = req.query;

    if (!procedure || !date) {
      return res.status(400).json({ message: "procedure and date are required" });
    }

    const pr = resolveProcedure(procedure);
    if (!pr.ok) {
      return res.status(400).json({ message: pr.message });
    }

    const [y, m, d] = String(date).split("-").map(Number);
    if (!isValidYMD(y, m, d)) {
      return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD required)" });
    }

    const variants = procedureVariantsForQuery(procedure);

    const used = await Appointment.countDocuments({
      procedure: { $in: variants },
      year: y,
      month: m,
      day: d,
      status: { $in: COUNT_STATUSES_FOR_CAPACITY },
    });

    const remaining = Math.max(pr.limit - used, 0);

    return res.json({
      procedure: pr.label, // standardized/canonical
      date: fmtYMD(y, m, d),
      limit: pr.limit,
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
    // Support either:
    //  - { procedure, date: "YYYY-MM-DD" }
    //  - { procedure, year, month, day }
    const { procedure, date, year, month, day } = req.body;

    if (!procedure) {
      return res.status(400).json({ message: "procedure is required" });
    }

    const pr = resolveProcedure(procedure);
    if (!pr.ok) {
      return res.status(400).json({ message: pr.message });
    }

    let y, m, d;

    if (date) {
      const parts = String(date).split("-").map(Number);
      if (parts.length !== 3) {
        return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD required)" });
      }
      [y, m, d] = parts;
    } else {
      if (year === undefined || month === undefined || day === undefined) {
        return res.status(400).json({ message: "year, month, day are required (or provide date)" });
      }
      y = Number(year);
      m = Number(month);
      d = Number(day);
    }

    if (!isValidYMD(y, m, d)) {
      return res.status(400).json({ message: "Invalid date" });
    }

    if (isPastDate(y, m, d)) {
      return res.status(400).json({ message: "Appointment date cannot be in the past" });
    }

    // ✅ Always store patientId as ObjectId
    const patientObjectId = new mongoose.Types.ObjectId(String(req.userId));

    const variants = procedureVariantsForQuery(procedure);

    /**
     * ✅ Enforce: patient cannot submit ANOTHER appointment if ANY active exists
     * Active = Pending or Approved
     */
    const existingActiveAny = await Appointment.findOne({
      patientId: patientIdQuery(req.userId), // robust match for old records
      status: { $in: ["Pending", "Approved"] },
    }).lean();

    if (existingActiveAny) {
      return res.status(409).json({
        message:
          `You already have an active appointment (${existingActiveAny.status}) for ${existingActiveAny.procedure} on ${fmtYMD(
            existingActiveAny.year,
            existingActiveAny.month,
            existingActiveAny.day
          )}. ` + `You can submit again only after it is Cancelled, Rejected, or Completed.`,
      });
    }

    // Capacity check (central across all users)
    if (pr.limit > 0) {
      const used = await Appointment.countDocuments({
        procedure: { $in: variants },
        year: y,
        month: m,
        day: d,
        status: { $in: COUNT_STATUSES_FOR_CAPACITY },
      });

      if (used >= pr.limit) {
        return res.status(409).json({
          message: `No available slots left for ${pr.label} on ${fmtYMD(y, m, d)}.`,
        });
      }
    }

    // Create as Pending
    const appt = await Appointment.create({
      patientId: patientObjectId,
      procedure: pr.label, // store standardized/canonical label
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
          "You already have an active appointment. " +
          "You can submit again only after it is Cancelled, Rejected, or Completed.",
      });
    }

    return res.status(500).json({ message: "Submission failed", error: err.message });
  }
});

// GET /api/appointments/mine  (list my appointments)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const appts = await Appointment.find({ patientId: patientIdQuery(req.userId) })
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

    const query = { patientId: patientIdQuery(req.userId) };

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

      const procedureLabel = a.billing?.label || a.billingLabel || a.procedureDone || a.procedure || "—";

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
      patientId: patientIdQuery(req.userId),
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