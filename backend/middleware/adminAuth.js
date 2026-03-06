// backend/middleware/adminAuth.js
const jwt = require("jsonwebtoken");
const Patient = require("../models/Patient");

async function requireAdminAuth(req, res, next) {
  const header = String(req.headers.authorization || "").trim();
  const [type, token] = header.split(/\s+/);

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Reject OTP-only tokens explicitly
  if (payload?.typ === "admin_otp" || payload?.typ === "otp") {
    return res.status(401).json({ message: "Invalid token type" });
  }

  const id = payload.sub || payload.id || payload.userId || payload._id;
  if (!id) return res.status(401).json({ message: "Invalid token payload" });

  try {
    const p = await Patient.findById(id).select("role isArchived isActive").lean();
    if (!p) return res.status(401).json({ message: "Not authenticated" });

    const role = String(p.role || "").trim().toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return res.status(401).json({ message: "Invalid token type" });
    }

    if (p.isArchived) return res.status(403).json({ message: "Account archived" });
    if (p.isActive === false) return res.status(403).json({ message: "Account disabled" });

    req.adminId = String(id);
    req.adminRole = role;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Auth check failed", error: err.message });
  }
}

function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.adminRole) return res.status(401).json({ message: "Not authenticated" });
    if (!roles.includes(req.adminRole)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

module.exports = { requireAdminAuth, requireAdminRole };