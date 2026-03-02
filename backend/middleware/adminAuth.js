// backend/middleware/adminAuth.js
const jwt = require("jsonwebtoken");

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ enforce admin token type so patient tokens can't access admin routes
    if (payload.typ !== "admin") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    req.adminId = payload.sub;
    req.adminRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
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