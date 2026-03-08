// backend/routes/upload.js
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const multer = require("multer");
const cloudinary = require("../utils/cloudinary");
const Patient = require("../models/Patient");
const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");

const router = express.Router();

// Use memory storage (buffer in RAM)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max (referral/receipt). Avatar has its own check below.
  },
});

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

function uploadBufferToCloudinary({ buffer, folder, resourceType, publicId, mimetype, format }) {
  const options = {
    folder,
    resource_type: resourceType, // "image" | "raw"
    public_id: publicId,
    overwrite: true,
  };

  // ✅ For PDFs, force Cloudinary to return a .pdf URL
  if (format) options.format = format;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * POST /api/upload/avatar
 * multipart/form-data:
 * - avatar: image file (JPG/PNG/etc)
 */
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Validate type
    if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "File must be an image" });
    }

    // Enforce 2MB for avatar
    const maxBytes = 2 * 1024 * 1024;
    if (req.file.size > maxBytes) {
      return res.status(400).json({ message: "Image too large (max 2MB)" });
    }

    // Upload to Cloudinary
    const publicId = `avatar_${req.userId}_${Date.now()}`;
    const result = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: "riswebapp/avatars",
      resourceType: "image",
      publicId,
      mimetype: req.file.mimetype,
    });

    const patient = await Patient.findByIdAndUpdate(
      req.userId,
      { $set: { avatarUrl: result.secure_url || "" } },
      { new: true, runValidators: true }
    );

    if (!patient) return res.status(404).json({ message: "Patient not found" });

    return res.json({ avatarUrl: result.secure_url || "", patient });
  } catch (err) {
    return res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

/**
 * POST /api/upload/referral
 * multipart/form-data:
 * - referral: PDF or image
 * - appointmentId: string (required)
 */
router.post("/referral", requireAuth, upload.single("referral"), async (req, res) => {
  try {
    const appointmentId = String(req.body?.appointmentId || "").trim();
    if (!appointmentId) {
      return res.status(400).json({ message: "appointmentId is required" });
    }

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const mimetype = req.file.mimetype || "";
    const isPdf = mimetype === "application/pdf";
    const isImage = mimetype.startsWith("image/");
    if (!isPdf && !isImage) {
      return res.status(400).json({ message: "Referral must be a PDF or image" });
    }

    // multer already has 10MB limit, but keep explicit message if needed
    const maxBytes = 10 * 1024 * 1024;
    if (req.file.size > maxBytes) {
      return res.status(400).json({ message: "File too large (max 10MB)" });
    }

    // Ensure appointment belongs to this patient
    const appt = await Appointment.findOne({
      _id: appointmentId,
      patientId: req.userId,
    });

    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    // Optional guardrail: only allow referral upload while Pending/Approved
    if (["Completed", "Cancelled", "Rejected"].includes(appt.status)) {
      return res.status(400).json({
        message: `Cannot upload referral when appointment is ${appt.status}.`,
      });
    }

    const publicId = `referral_${appointmentId}_${Date.now()}`;
    const uploadRes = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: "riswebapp/referrals",
      resourceType: isPdf ? "raw" : "image",
      publicId,
      mimetype,
      format: isPdf ? "pdf" : undefined,
    });

    appt.referralUrl = uploadRes.secure_url || "";
    appt.referralUploadedAt = new Date();
    await appt.save();

    return res.json({
      referralUrl: appt.referralUrl,
      appointment: appt,
    });
  } catch (err) {
    // Multer file too large
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 10MB)" });
    }

    return res.status(500).json({ message: "Referral upload failed", error: err.message });
  }
});

/**
 * ✅ Patient uploads payment receipt for a bill
 *
 * POST /api/upload/bill-receipt
 * multipart/form-data:
 * - receipt: PDF or image (PNG/JPG/WebP)
 * - billId: string (required)
 *
 * ✅ NEW behavior:
 * - sets bill.receiptUrl
 * - AND updates bill.status = "For Confirmation" (stored in MongoDB)
 * - does NOT set paidAt (admin sets Paid)
 */
router.post("/bill-receipt", requireAuth, upload.single("receipt"), async (req, res) => {
  try {
    const billId = String(req.body?.billId || "").trim();
    if (!billId) return res.status(400).json({ message: "billId is required" });

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ message: "Invalid billId" });
    }

    if (!req.file) return res.status(400).json({ message: "Receipt file is required." });

    const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Receipt must be PDF or image (PNG/JPG/WebP)." });
    }

    // Explicit limit message if needed (multer also enforces this)
    const maxBytes = 10 * 1024 * 1024;
    if (req.file.size > maxBytes) {
      return res.status(400).json({ message: "File too large (max 10MB)" });
    }

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    // Ensure bill belongs to this patient
    if (String(bill.patientId) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Optional: don’t allow receipt upload if voided
    if (String(bill.status || "") === "Voided") {
      return res.status(400).json({ message: "Cannot upload receipt for a voided bill." });
    }

    const isPdf = req.file.mimetype === "application/pdf";
    const ext = isPdf ? ".pdf" : ".jpg";
    const safeName = `bill_${bill._id}_${Date.now()}${ext}`;
    const publicId = safeName.replace(/\.(pdf|png|jpe?g|webp)$/i, "");

    const uploaded = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: "riswebapp/receipts",
      resourceType: isPdf ? "raw" : "image",
      publicId,
      mimetype: req.file.mimetype,
      format: isPdf ? "pdf" : undefined,
    });

    bill.receiptUrl = uploaded.secure_url || "";

    // ✅ IMPORTANT: persist status in DB (NOT computed)
    // Only bump to "For Confirmation" if not already Paid
    const current = String(bill.status || "").trim();
    if (current !== "Paid") {
      bill.status = "For Confirmation";
      // don't touch paidAt here
    }

    await bill.save();

    return res.json(bill.toObject());
  } catch (err) {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 10MB)" });
    }

    return res.status(500).json({ message: "Upload receipt failed", error: err.message });
  }
});

module.exports = router;