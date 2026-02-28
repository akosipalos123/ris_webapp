// backend/utils/admin.js
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(String(email || "").trim().toLowerCase());
}

module.exports = { isAdminEmail };
