// backend/utils/mailer.js
const { google } = require("googleapis");

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeRawEmail({ to, from, subject, text }) {
  const message =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    `${text}\r\n`;

  return base64UrlEncode(message);
}

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_SENDER,
  GMAIL_REDIRECT_URI,
  MAIL_FROM,
} = process.env;

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI || "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

async function sendOtpEmail(to, otp) {
  const from = MAIL_FROM || GMAIL_SENDER;
  if (!from) throw new Error("Missing GMAIL_SENDER (or MAIL_FROM)");

  const subject = "Your Login OTP Code";
  const text = `Your OTP code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  const raw = makeRawEmail({ to, from, subject, text });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

module.exports = { sendOtpEmail };