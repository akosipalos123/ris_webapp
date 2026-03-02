const mongoose = require("mongoose");
require("dotenv").config();

const uri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  process.env.DATABASE_URL;

if (!uri) {
  console.error("❌ Missing Mongo connection string. Set MONGO_URI (or MONGODB_URI/DB_URI/DATABASE_URL) in backend/.env");
  process.exit(1);
}

(async () => {
  await mongoose.connect(uri);

  const User = require("../models/User");

  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!admins.length) {
    console.log("No ADMIN_EMAILS set. Nothing to migrate.");
    process.exit(0);
  }

  const res = await User.updateMany(
    { email: { $in: admins } },
    { $set: { role: "admin" } }
  );

  console.log(`Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});