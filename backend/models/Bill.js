// backend/models/Bill.js
const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" }, // e.g. "CHEST_ADULT"
    label: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
    qty: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const billingSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, default: "PHP" },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
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
    },

    // keep for backward compatibility with your current UI
    procedure: { type: String, trim: true, default: "" },

    // billing snapshot (what admin selected at completion)
    billing: { type: billingSchema, default: () => ({}) },

    // itemized billing (optional)
    items: { type: [billItemSchema], default: [] },

    // computed from items, or fallback to billing.amount, or explicitly set
    totalAmount: { type: Number, min: 0, default: 0 },

    currency: { type: String, trim: true, default: "PHP" },

    // optional: link to receipt (admin upload or reuse resultPdfUrl)
    receiptUrl: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["Pending", "Unpaid", "Paid", "Voided"],
      default: "Pending",
      index: true,
    },

    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// One bill per appointment
billSchema.index({ appointmentId: 1 }, { unique: true });

// Helpful query index
billSchema.index({ patientId: 1, issuedAt: -1 });

// Keep totalAmount consistent with items[] (but DO NOT overwrite to 0 if items[] is empty)
billSchema.pre("save", function (next) {
  // currency fallback (prefer billing currency if provided)
  if (!this.currency || String(this.currency).trim() === "") {
    this.currency = this.billing?.currency || "PHP";
  }

  // If there are items, compute from items
  if (Array.isArray(this.items) && this.items.length > 0) {
    const sum = this.items.reduce((acc, it) => {
      const qty = Number(it.qty) || 1;
      const amt = Number(it.amount) || 0;
      return acc + amt * qty;
    }, 0);

    this.totalAmount = Math.max(0, sum);

    // keep procedure populated if blank
    if (!this.procedure && this.items[0]?.label) this.procedure = this.items[0].label;

    return next();
  }

  // If no items, fall back to billing snapshot amount (if present)
  const billingAmt = Number(this.billing?.amount);
  if (Number.isFinite(billingAmt) && billingAmt > 0) {
    const current = Number(this.totalAmount);
    if (!Number.isFinite(current) || current <= 0) {
      this.totalAmount = billingAmt;
    }
    if (!this.procedure && this.billing?.label) this.procedure = this.billing.label;
    if ((!this.currency || String(this.currency).trim() === "") && this.billing?.currency) {
      this.currency = this.billing.currency;
    }
  }

  // last guard
  if (!Number.isFinite(Number(this.totalAmount)) || Number(this.totalAmount) < 0) {
    this.totalAmount = 0;
  }

  next();
});

module.exports = mongoose.model("Bill", billSchema);