const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Patient = require("../models/Patient"); // ✅ ADD (admins are stored in Patient in your project)
const Appointment = require("../models/Appointment"); // ✅ ADD (needed for by-appointment status update)

const router = express.Router();

const ALLOWED_STATUSES = new Set([
  "Pending",
  "Unpaid",
  "For Confirmation",
  "Paid",
  "University Guarantee - Research",
  "University Guarantee - Medical",
  "Voided",
]);

// ✅ UPDATED: supports tokens that only contain { sub, iat, exp }
// - If verified by ADMIN_JWT_SECRET -> allow
// - Else allow if token has admin claims (role/isAdmin/typ)
// - Else fallback to DB role check using Patient model
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const secrets = [process.env.ADMIN_JWT_SECRET, process.env.JWT_SECRET].filter(Boolean);

  let payload = null;
  let usedAdminSecret = false;

  for (const s of secrets) {
    try {
      payload = jwt.verify(token, s);
      usedAdminSecret = s === process.env.ADMIN_JWT_SECRET && !!process.env.ADMIN_JWT_SECRET;
      break;
    } catch {}
  }

  if (!payload) return res.status(401).json({ message: "Invalid or expired token" });

  const adminId = String(payload.sub || payload.id || payload.userId || "").trim();
  if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
    return res.status(401).json({ message: "Invalid token payload" });
  }

  // ✅ If verified using ADMIN secret, allow immediately
  if (usedAdminSecret) {
    req.adminId = adminId;
    return next();
  }

  // ✅ If token contains admin claims, allow
  const role = String(payload.role || payload.userType || "").trim().toLowerCase();
  const isAdminClaim =
    payload.isAdmin === true ||
    role === "admin" ||
    role === "superadmin" ||
    payload.typ === "admin";

  if (isAdminClaim) {
    req.adminId = adminId;
    return next();
  }

  // ✅ Fallback: DB role check (needed for tokens that only have {sub,iat,exp})
  try {
    const acct = await Patient.findById(adminId).select("role isArchived isActive").lean();
    const dbRole = String(acct?.role || "").trim().toLowerCase();

    if (!acct) return res.status(403).json({ message: "Admin access required" });
    if (acct?.isArchived) return res.status(403).json({ message: "Account archived" });
    if (acct?.isActive === false) return res.status(403).json({ message: "Account disabled" });

    if (dbRole !== "admin" && dbRole !== "superadmin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.adminId = adminId;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Admin validation failed", error: err.message });
  }
}

/**
 * GET /api/admin/bills?appointmentIds=id1,id2,id3
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const raw = String(req.query.appointmentIds || "").trim();
    if (!raw) return res.json([]);

    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const objIds = [];
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid appointmentId: ${id}` });
      }
      objIds.push(new mongoose.Types.ObjectId(id));
    }

    const bills = await Bill.find({ appointmentId: { $in: objIds } })
      .populate("appointmentId", "procedure year month day status")
      .sort({ issuedAt: -1, createdAt: -1 })
      .lean();

    return res.json(bills);
  } catch (err) {
    return res.status(500).json({ message: "Fetch bills failed", error: err.message });
  }
});

/**
 * ✅ NEW (FIX): PATCH /api/admin/bills/by-appointment/:appointmentId/status
 * Body: { status: "<allowed>" }
 *
 * This matches the frontend call when billId is missing:
 * PATCH /api/admin/bills/by-appointment/<apptId>/status
 */
router.patch("/by-appointment/:appointmentId/status", requireAdmin, async (req, res) => {
  try {
    const appointmentId = String(req.params.appointmentId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointmentId" });
    }

    const nextStatus = String(req.body?.status || "").trim();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Need patientId when creating a bill (Bill schema requires patientId)
    const appt = await Appointment.findById(appointmentId)
      .select("_id patientId procedure")
      .lean();

    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const proc = String(appt?.procedure || "").trim();

    const updateOps = {
      $set: { status: nextStatus },
      $setOnInsert: {
        patientId: appt.patientId,
        appointmentId: appt._id,
        procedure: proc,
        billing: { label: proc, amount: 0, currency: "PHP" },
        totalAmount: 0,
        currency: "PHP",
        receiptUrl: "",
        issuedAt: new Date(),
      },
    };

    if (nextStatus === "Paid") {
      updateOps.$set.paidAt = new Date();
    } else {
      updateOps.$unset = { paidAt: "" };
    }

    const updated = await Bill.findOneAndUpdate(
      { appointmentId: appt._id },
      updateOps,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Update bill status failed", error: err.message });
  }
});

/**
 * PATCH /api/admin/bills/:billId/status
 * Body: { status: "<allowed>" }
 */
router.patch("/:billId/status", requireAdmin, async (req, res) => {
  try {
    const billId = String(req.params.billId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ message: "Invalid billId" });
    }

    const nextStatus = String(req.body?.status || "").trim();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const update = { status: nextStatus };
    if (nextStatus === "Paid") update.paidAt = new Date();

    const updated = await Bill.findByIdAndUpdate(
      billId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Bill not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Update bill status failed", error: err.message });
  }
});

module.exports = router;