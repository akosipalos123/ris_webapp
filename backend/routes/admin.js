// backend/routes/admin.js
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");

const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");
const cloudinary = require("../utils/cloudinary");

// ✅ NEW: admin-only auth middleware (separate from patient tokens)
const { requireAdminAuth, requireAdminRole } = require("../middleware/adminAuth");

const router = express.Router();

// Keep in sync with backend/routes/appointments.js
const DAILY_LIMITS = {
  "X-Ray": 15,
};

const COUNT_STATUSES_FOR_CAPACITY = ["Pending", "Approved"];

function fmtYMD(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ✅ Require either admin or superadmin
const requireAnyAdmin = [requireAdminAuth, requireAdminRole("admin", "superadmin")];

// ===== Existing: GET appointments (admin) =====
router.get("/appointments", ...requireAnyAdmin, async (req, res) => {
  try {
    const { status, procedure, date } = req.query;

    const query = {};
    if (status) query.status = status;
    if (procedure) query.procedure = procedure;

    if (date) {
      const [y, m, d] = String(date).split("-").map(Number);
      if (![y, m, d].every(Number.isInteger)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      query.year = y;
      query.month = m;
      query.day = d;
    }

    const appts = await Appointment.find(query)
      // ✅ include bsrtId so frontend can display it instead of _id
      .populate("patientId", "firstName lastName email bsrtId")
      .sort({ year: 1, month: 1, day: 1, createdAt: -1 })
      .lean();

    return res.json(appts);
  } catch (err) {
    return res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

// ===== Existing: PATCH appointment status =====
router.patch("/appointments/:id/status", ...requireAnyAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const allowed = ["Pending", "Approved", "Rejected", "Cancelled", "Completed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const current = await Appointment.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Appointment not found" });

    if (status === "Approved") {
      const limit = DAILY_LIMITS[current.procedure] ?? 0;

      if (limit > 0) {
        const used = await Appointment.countDocuments({
          _id: { $ne: current._id },
          procedure: current.procedure,
          year: current.year,
          month: current.month,
          day: current.day,
          status: { $in: COUNT_STATUSES_FOR_CAPACITY },
        });

        if (used >= limit) {
          return res.status(409).json({
            message: `Cannot approve. No slots left for ${current.procedure} on ${fmtYMD(
              current.year,
              current.month,
              current.day
            )}.`,
          });
        }
      }
    }

    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
      // ✅ include bsrtId so frontend can display it instead of _id
    ).populate("patientId", "firstName lastName email bsrtId");

    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: "Update failed", error: err.message });
  }
});

// ===== Complete with RESULT FILE (PDF/DICOM) + Description + Impression + Billing =====
const uploadResult = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

function getLowerExt(filename) {
  const n = String(filename || "");
  const idx = n.lastIndexOf(".");
  return idx >= 0 ? n.slice(idx + 1).toLowerCase() : "";
}

function isPdfUpload(file) {
  if (!file) return false;
  const ext = getLowerExt(file.originalname);
  const mt = String(file.mimetype || "").toLowerCase();
  return mt === "application/pdf" || ext === "pdf";
}

function isDicomUpload(file) {
  if (!file) return false;
  const ext = getLowerExt(file.originalname);
  const mt = String(file.mimetype || "").toLowerCase();

  // DICOM often arrives as application/octet-stream; extension is the reliable signal
  if (ext === "dcm" || ext === "dicom") return true;

  // If a client sends a dicom mimetype, accept it too
  return mt.includes("dicom");
}

function uploadRawBufferToCloudinary(buffer, publicIdWithExt) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "riswebapp/results",
        resource_type: "raw",
        public_id: publicIdWithExt, // include extension for raw
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

router.post(
  "/appointments/:id/complete",
  ...requireAnyAdmin,
  uploadResult.single("resultPdf"), // keep field name used by frontend
  async (req, res) => {
    try {
      const description = String(req.body?.notes || "").trim(); // Description *
      const impression = String(req.body?.impression || "").trim(); // Impression *

      const billingCode = String(req.body?.billingCode || "").trim();
      const billingLabel = String(req.body?.billingLabel || "").trim();
      const billingCurrency = String(req.body?.billingCurrency || "PHP").trim() || "PHP";
      const amount = Number(String(req.body?.billingAmount ?? "").replace(/[^0-9.-]/g, ""));

      if (!billingCode || !billingLabel || !Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: "Billing details are required." });
      }

      if (!description) return res.status(400).json({ message: "Description is required." });
      if (!impression) return res.status(400).json({ message: "Impression is required." });

      if (!req.file) return res.status(400).json({ message: "Result file is required (PDF or DICOM)." });

      const okPdf = isPdfUpload(req.file);
      const okDicom = isDicomUpload(req.file);
      if (!okPdf && !okDicom) {
        return res.status(400).json({ message: "File must be a PDF or DICOM (.dcm/.dicom)." });
      }

      const appt = await Appointment.findById(req.params.id);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      const now = Date.now();
      let ext = getLowerExt(req.file.originalname);
      if (okPdf) ext = "pdf";
      if (ext === "dicom") ext = "dcm";
      if (!ext) ext = okDicom ? "dcm" : "pdf";

      const publicIdWithExt = `appt_${appt._id}_${now}.${ext}`;
      const uploaded = await uploadRawBufferToCloudinary(req.file.buffer, publicIdWithExt);

      appt.status = "Completed";
      appt.resultPdfUrl = uploaded.secure_url || ""; // keep existing field name for compatibility
      appt.resultNotes = description; // Description
      appt.impression = impression; // uses existing schema field
      appt.completedAt = new Date();

      // ✅ Admin is now a User, not a Patient
      appt.completedBy = req.adminId;

      appt.billing = {
        code: billingCode,
        label: billingLabel,
        amount,
        currency: billingCurrency,
      };

      await appt.save();

      await Bill.findOneAndUpdate(
        { appointmentId: appt._id },
        {
          $set: {
            patientId: appt.patientId,
            appointmentId: appt._id,

            procedure: billingLabel,
            totalAmount: amount,
            currency: billingCurrency,

            billing: {
              code: billingCode,
              label: billingLabel,
              amount,
              currency: billingCurrency,
            },

            items: [{ code: billingCode, label: billingLabel, amount, qty: 1 }],

            status: "Pending",
            issuedAt: appt.completedAt || new Date(),
            receiptUrl: "",
          },
          $unset: { paidAt: "" },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );

      // ✅ include bsrtId so frontend can display it instead of _id
      const populated = await Appointment.findById(appt._id).populate("patientId", "firstName lastName email bsrtId");
      return res.json(populated);
    } catch (err) {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large (max 10MB)" });
      }
      return res.status(500).json({ message: "Complete failed", error: err.message });
    }
  }
);

// ===== BILL (legacy create/update per appointment) =====
router.post("/appointments/:id/bill", ...requireAnyAdmin, async (req, res) => {
  try {
    const appointmentId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const appt = await Appointment.findById(appointmentId).lean();
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const status = String(req.body?.status || "Pending").trim();

    const allowedBillStatus = ["Pending", "Unpaid", "Paid", "Voided"];
    if (!allowedBillStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid bill status" });
    }

    const cleanedItems = items
      .map((it) => ({
        label: String(it?.label || "").trim(),
        amount: Number(it?.amount || 0),
      }))
      .filter((it) => it.label && Number.isFinite(it.amount) && it.amount >= 0);

    const totalAmount = cleanedItems.reduce((sum, it) => sum + it.amount, 0);

    const updateOps = {
      $set: {
        patientId: appt.patientId,
        appointmentId,
        procedure: appt.procedure || "",
        items: cleanedItems,
        totalAmount,
        status,
        issuedAt: new Date(),
      },
    };

    if (status === "Paid") updateOps.$set.paidAt = new Date();
    else updateOps.$unset = { paidAt: "" };

    const doc = await Bill.findOneAndUpdate({ appointmentId }, updateOps, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }).lean();

    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ message: "Save bill failed", error: err.message });
  }
});

router.get("/appointments/:id/bill", ...requireAnyAdmin, async (req, res) => {
  try {
    const appointmentId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const bill = await Bill.findOne({ appointmentId }).lean();
    return res.json(bill || null);
  } catch (err) {
    return res.status(500).json({ message: "Fetch bill failed", error: err.message });
  }
});

router.patch("/bills/:id/status", ...requireAnyAdmin, async (req, res) => {
  try {
    const billId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({ message: "Invalid bill id" });
    }

    const nextStatus = String(req.body?.status || "").trim();
    const allowed = ["Pending", "Unpaid", "Paid", "Voided"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid bill status" });
    }

    const updateOps = { $set: { status: nextStatus } };
    if (nextStatus === "Paid") updateOps.$set.paidAt = new Date();
    else updateOps.$unset = { paidAt: "" };

    const bill = await Bill.findByIdAndUpdate(billId, updateOps, {
      new: true,
      runValidators: true,
    }).lean();

    if (!bill) return res.status(404).json({ message: "Bill not found" });
    return res.json(bill);
  } catch (err) {
    return res.status(500).json({ message: "Update bill status failed", error: err.message });
  }
});

// ===== Upload payment receipt for a bill =====
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function uploadReceiptBufferToCloudinary(buffer, filename, mimetype) {
  const isPdf = mimetype === "application/pdf";
  const resourceType = isPdf ? "raw" : "image";
  const publicId = filename.replace(/\.(pdf|png|jpe?g|webp)$/i, "");

  const options = {
    folder: "riswebapp/receipts",
    resource_type: resourceType,
    public_id: publicId,
    overwrite: true,
  };

  if (isPdf) options.format = "pdf";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

router.post(
  "/bills/:id/receipt",
  ...requireAnyAdmin,
  uploadReceipt.single("receipt"),
  async (req, res) => {
    try {
      const billId = String(req.params.id || "").trim();
      if (!mongoose.Types.ObjectId.isValid(billId)) {
        return res.status(400).json({ message: "Invalid bill id" });
      }

      if (!req.file) return res.status(400).json({ message: "Receipt file is required." });

      const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!okTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Receipt must be PDF or image (PNG/JPG/WebP)." });
      }

      const bill = await Bill.findById(billId);
      if (!bill) return res.status(404).json({ message: "Bill not found" });

      const ext = req.file.mimetype === "application/pdf" ? ".pdf" : ".jpg";
      const safeName = `bill_${bill._id}_${Date.now()}${ext}`;
      const uploaded = await uploadReceiptBufferToCloudinary(req.file.buffer, safeName, req.file.mimetype);

      bill.receiptUrl = uploaded.secure_url || "";
      await bill.save();

      return res.json(bill.toObject());
    } catch (err) {
      return res.status(500).json({ message: "Upload receipt failed", error: err.message });
    }
  }
);

// ===== Diagnostic Images Upload =====
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
});

router.post(
  "/appointments/:id/diagnostic-images",
  ...requireAnyAdmin,
  uploadImages.array("images", 12),
  async (req, res) => {
    try {
      const appointmentId = String(req.params.id || "").trim();
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({ message: "Invalid appointment id" });
      }

      const appt = await Appointment.findById(appointmentId);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      const caption = String(req.body?.caption || "").trim();

      const radiographType = String(req.body?.radiographType || "").trim();
      const findings = String(req.body?.findings || "").trim();
      const impression = String(req.body?.impression || "").trim();
      const interpretation = String(req.body?.interpretation || "").trim();

      const uploads = [];
      for (const f of req.files) {
        if (!f.mimetype.startsWith("image/")) {
          return res.status(400).json({ message: "All files must be images" });
        }

        const base64 = f.buffer.toString("base64");
        const dataUri = `data:${f.mimetype};base64,${base64}`;

        // eslint-disable-next-line no-await-in-loop
        const result = await cloudinary.uploader.upload(dataUri, {
          folder: "riswebapp/diagnostic_images",
          resource_type: "image",
        });

        uploads.push({
          url: result.secure_url || "",
          publicId: result.public_id || "",
          uploadedAt: new Date(),
          caption,
        });
      }

      appt.diagnosticImages = [...(appt.diagnosticImages || []), ...uploads];

      if (radiographType) appt.radiographType = radiographType;
      if (findings) appt.findings = findings;
      if (impression) appt.impression = impression;
      if (interpretation) appt.interpretation = interpretation;

      await appt.save();

      // ✅ include bsrtId so frontend can display it instead of _id
      const populated = await Appointment.findById(appt._id).populate(
        "patientId",
        "firstName lastName email bsrtId"
      );
      return res.json(populated);
    } catch (err) {
      return res.status(500).json({ message: "Upload images failed", error: err.message });
    }
  }
);

// ===== Update report fields (no files) =====
router.patch("/appointments/:id/report", ...requireAnyAdmin, async (req, res) => {
  try {
    const appointmentId = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const payload = {};
    const fields = ["radiographType", "findings", "impression", "interpretation"];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) payload[f] = String(req.body[f] || "").trim();
    }

    const appt = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: payload },
      { new: true }
      // ✅ include bsrtId so frontend can display it instead of _id
    ).populate("patientId", "firstName lastName email bsrtId");

    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    return res.json(appt);
  } catch (err) {
    return res.status(500).json({ message: "Update report failed", error: err.message });
  }
});

module.exports = router;