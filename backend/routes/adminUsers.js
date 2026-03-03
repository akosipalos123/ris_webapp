// backend/routes/adminUsers.js
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const Patient = require("../models/Patient");
const Counter = require("../models/Counter");

const router = express.Router();

/* ---------------- AUTH (patient token) ---------------- */
function requirePatientAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.patientId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function requireSuperAdmin(req, res, next) {
  const p = await Patient.findById(req.patientId).lean();
  if (!p) return res.status(401).json({ message: "Not found" });

  const role = String(p.role || "").trim().toLowerCase();
  if (role !== "superadmin") return res.status(403).json({ message: "Forbidden" });

  if (p.isArchived) return res.status(403).json({ message: "Account archived" });
  if (p.isActive === false) return res.status(403).json({ message: "Account disabled" });

  req.patient = p;
  next();
}

/* ---------------- BSRT ADMIN ID ---------------- */
async function nextAdminBsrtId() {
  const c = await Counter.findByIdAndUpdate(
    "admins",
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // ✅ consistent with your UI (all-caps prefix)
  return `BSRTADMIN${String(c.seq).padStart(8, "0")}`;
}

// GET /api/admin/users
router.get("/", requirePatientAuth, requireSuperAdmin, async (req, res) => {
  try {
    const docs = await Patient.find({ role: { $in: ["admin", "superadmin"] } })
      .select("bsrtId firstName lastName email role isArchived isActive createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ message: "Fetch admins failed", error: err.message });
  }
});

// POST /api/admin/users (manual create)
router.post("/", requirePatientAuth, requireSuperAdmin, async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "admin").trim().toLowerCase();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "firstName, lastName, email, password are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!["admin", "superadmin"].includes(role)) return res.status(400).json({ message: "Invalid role" });

    const exists = await Patient.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const bsrtId = await nextAdminBsrtId();
    const passwordHash = await bcrypt.hash(password, 12);

    const doc = await Patient.create({
      bsrtId,
      role,
      firstName,
      lastName,
      email,
      passwordHash,
      isArchived: false,
      isActive: true,
    });

    return res.status(201).json({
      _id: doc._id,
      bsrtId: doc.bsrtId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      role: doc.role,
      isArchived: doc.isArchived,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Create admin failed", error: err.message });
  }
});

// PATCH /api/admin/users/:id
router.patch("/:id", requirePatientAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const update = {};
    if (req.body?.firstName !== undefined) update.firstName = String(req.body.firstName || "").trim();
    if (req.body?.lastName !== undefined) update.lastName = String(req.body.lastName || "").trim();
    if (req.body?.email !== undefined) update.email = String(req.body.email || "").trim().toLowerCase();
    if (req.body?.role !== undefined) update.role = String(req.body.role || "admin").trim().toLowerCase();
    if (req.body?.isArchived !== undefined) update.isArchived = !!req.body.isArchived;
    if (req.body?.isActive !== undefined) update.isActive = !!req.body.isActive;

    if (update.role && !["admin", "superadmin"].includes(update.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (update.email) {
      const conflict = await Patient.findOne({ email: update.email, _id: { $ne: id } }).lean();
      if (conflict) return res.status(409).json({ message: "Email already exists" });
    }

    const doc = await Patient.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .select("bsrtId firstName lastName email role isArchived isActive createdAt updatedAt")
      .lean();

    if (!doc) return res.status(404).json({ message: "Admin not found" });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Update admin failed", error: err.message });
  }
});

module.exports = router;