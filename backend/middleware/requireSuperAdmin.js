// backend/middleware/requireSuperAdmin.js
const jwt = require("jsonwebtoken");
const Patient = require("../models/Patient");
const User = require("../models/User");

function parseEmails(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const SUPER_ADMIN_EMAILS = new Set(
  parseEmails(process.env.SUPER_ADMIN_EMAILS || process.env.ADMIN_EMAILS)
);

async function requireSuperAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Admin-token path (if you later use adminToken)
  if (payload.typ === "admin") {
    const admin = await User.findById(payload.sub).select("email role isArchived").lean();
    if (!admin || admin.isArchived) return res.status(401).json({ message: "Invalid session" });
    if (admin.role !== "superadmin") return res.status(403).json({ message: "Superadmin access required" });

    req.superAdmin = {
      tokenType: "admin",
      id: admin._id.toString(),
      email: String(admin.email || "").toLowerCase(),
    };
    return next();
  }

  // Patient-token path (your current OTP login)
  const patient = await Patient.findById(payload.sub).select("email isActive").lean();
  if (!patient || patient.isActive === false) return res.status(401).json({ message: "Invalid session" });

  const email = String(patient.email || "").toLowerCase();
  if (!SUPER_ADMIN_EMAILS.has(email)) {
    return res.status(403).json({ message: "Superadmin access required" });
  }

  req.superAdmin = {
    tokenType: "patient",
    id: patient._id.toString(),
    email,
  };
  return next();
}

module.exports = { requireSuperAdmin };