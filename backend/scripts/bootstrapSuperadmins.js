// backend/scripts/bootstrapSuperadmins.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

function getAdminEmailsFromEnv() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  const initPw = process.env.SUPERADMIN_INIT_PASSWORD;
  if (!initPw || initPw.length < 8) {
    throw new Error("Missing SUPERADMIN_INIT_PASSWORD (min 8 chars)");
  }

  await mongoose.connect(uri);

  const emails = getAdminEmailsFromEnv();
  if (!emails.length) {
    console.log("No ADMIN_EMAILS configured. Nothing to bootstrap.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(initPw, 12);

  for (const email of emails) {
    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.role !== "superadmin") {
        existing.role = "superadmin";
        await existing.save();
        console.log("Upgraded to superadmin:", email);
      } else {
        console.log("Already superadmin:", email);
      }
      continue;
    }

    await User.create({
      email,
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      role: "superadmin",
    });

    console.log("Created superadmin:", email);
  }

  console.log("Done.");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});