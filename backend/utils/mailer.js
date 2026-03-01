// backend/utils/mailer.js
const nodemailer = require("nodemailer");

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !user || !pass) {
  console.warn(
    "[mailer] Missing env vars. Need SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT)."
  );
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // ✅ true for 465 (SSL), false for 587 (STARTTLS)
  auth: { user, pass },

  // ✅ fail faster (helps with timeouts)
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

async function sendOtpEmail(to, otp) {
  const from = process.env.MAIL_FROM || user;

  await transporter.sendMail({
    from,
    to,
    subject: "Your Login OTP Code",
    text: `Your OTP code is: ${otp}\n\nThis code will expire in 10 minutes.`,
  });
}

module.exports = { sendOtpEmail };