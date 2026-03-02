// backend/routes/adminUsers.js
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");
const { requireSuperAdmin } = require("../middleware/requireSuperAdmin");

const router = express.Router();

// GET /api/admin/users
router.get("/", requireSuperAdmin, async (req, res) => {
  try {
    const docs = await User.find({ role: { $in: ["admin", "superadmin"] } })
      .select("firstName lastName email role isArchived createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ message: "Fetch admins failed", error: err.message });
  }
});

// POST /api/admin/users
router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "admin").trim();

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "firstName, lastName, email, password are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!["admin", "superadmin"].includes(role)) return res.status(400).json({ message: "Invalid role" });

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);

    const doc = await User.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role,
      isArchived: false,
    });

    return res.status(201).json({
      _id: doc._id,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      role: doc.role,
      isArchived: doc.isArchived,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ message: "Create admin failed", error: err.message });
  }
});

// PATCH /api/admin/users/:id
router.patch("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const update = {};
    if (req.body?.firstName !== undefined) update.firstName = String(req.body.firstName || "").trim();
    if (req.body?.lastName !== undefined) update.lastName = String(req.body.lastName || "").trim();
    if (req.body?.email !== undefined) update.email = String(req.body.email || "").trim().toLowerCase();
    if (req.body?.role !== undefined) update.role = String(req.body.role || "admin").trim();
    if (req.body?.isArchived !== undefined) update.isArchived = !!req.body.isArchived;

    if (update.role && !["admin", "superadmin"].includes(update.role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (update.email) {
      const conflict = await User.findOne({ email: update.email, _id: { $ne: id } }).lean();
      if (conflict) return res.status(409).json({ message: "Email already exists" });
    }

    const doc = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .select("firstName lastName email role isArchived createdAt updatedAt")
      .lean();

    if (!doc) return res.status(404).json({ message: "Admin not found" });
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Update admin failed", error: err.message });
  }
});

module.exports = router;