// backend/utils/mailer.js
const { google } = require("googleapis");

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Builds raw RFC822 email.
 * - If html provided, sends multipart/alternative (text + html)
 * - Otherwise sends plain text
 */
function makeRawEmail({ to, from, subject, text, html }) {
  const safeText = String(text || "");
  const safeHtml = html ? String(html) : "";

  if (safeHtml) {
    const boundary = `BOUNDARY_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const message =
      `From: ${from}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      `${safeText}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
      `${safeHtml}\r\n\r\n` +
      `--${boundary}--\r\n`;

    return base64UrlEncode(message);
  }

  const message =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    `${safeText}\r\n`;

  return base64UrlEncode(message);
}

function missingEnv(keys) {
  return keys.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
}

let _oauth2Client = null;
let _gmail = null;

function getOAuth2Client() {
  if (_oauth2Client) return _oauth2Client;

  const redirect =
    process.env.GMAIL_REDIRECT_URI || "https://developers.google.com/oauthplayground";

  _oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirect
  );

  _oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return _oauth2Client;
}

function getGmailClient() {
  if (_gmail) return _gmail;
  const oauth2Client = getOAuth2Client();
  _gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return _gmail;
}

function normalizeEmailHeader(from) {
  // Allow: "Name <email@domain.com>" or "email@domain.com"
  return String(from || "").trim();
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return "in 5 days";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "in 5 days";
  return d.toLocaleString();
}

/**
 * ✅ Generic Gmail sender (plain text + optional html)
 */
async function sendEmail({ to, subject, text, html }) {
  const required = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GMAIL_SENDER",
  ];
  const missing = missingEnv(required);
  if (missing.length) {
    throw new Error(
      `Gmail not configured. Missing: ${missing.join(", ")}.`
    );
  }

  const from = normalizeEmailHeader(process.env.MAIL_FROM || process.env.GMAIL_SENDER);
  if (!from) throw new Error("Missing MAIL_FROM or GMAIL_SENDER");

  const raw = makeRawEmail({
    to,
    from,
    subject: String(subject || "").trim() || "(no subject)",
    text: String(text || ""),
    html: html ? String(html) : undefined,
  });

  try {
    const oauth2Client = getOAuth2Client();
    await oauth2Client.getAccessToken();

    const gmail = getGmailClient();
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    const apiMsg =
      err?.response?.data?.error?.message ||
      err?.response?.data?.error_description ||
      err?.message ||
      "Unknown error";

    if (String(apiMsg).toLowerCase().includes("invalid_grant")) {
      throw new Error(
        `Gmail send failed: invalid_grant (refresh token revoked/expired or redirect URI mismatch). Recreate refresh token and ensure Gmail API scope includes gmail.send.`
      );
    }

    throw new Error(`Gmail send failed: ${apiMsg}`);
  }
}

/**
 * ✅ OTP email (keeps your dev console mode)
 */
async function sendOtpEmail(to, otp) {
  // ✅ DEV MODE: print OTP instead of email
  if (String(process.env.OTP_DELIVERY || "").toLowerCase() === "console") {
    // eslint-disable-next-line no-console
    console.log(`[OTP] ${to}: ${otp}`);
    return;
  }

  const subject = process.env.OTP_EMAIL_SUBJECT || "Your OTP Code";
  const text = `Your OTP code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  await sendEmail({ to, subject, text });
}

/**
 * ✅ NEW: Admin invite email
 * Called by /api/admin/invites when generating invite links.
 */
async function sendAdminInviteEmail(to, inviteLink, expiresAt) {
  // Optional dev mode:
  if (String(process.env.INVITE_DELIVERY || "").toLowerCase() === "console") {
    // eslint-disable-next-line no-console
    console.log(`[ADMIN INVITE] ${to}\n${inviteLink}\nExpires: ${formatExpiry(expiresAt)}`);
    return;
  }

  const subject = process.env.ADMIN_INVITE_EMAIL_SUBJECT || "Admin Account Invitation (AXIS)";
  const exp = formatExpiry(expiresAt);

  const text =
    `You have been invited to create an Admin account for AXIS.\n\n` +
    `Registration link:\n${inviteLink}\n\n` +
    `This link will expire: ${exp}\n\n` +
    `If you did not request this, you may ignore this email.`;

  const html =
    `<div style="font-family:Arial,sans-serif;line-height:1.5">` +
    `<h2 style="margin:0 0 10px">Admin Account Invitation</h2>` +
    `<p>You have been invited to create an <b>Admin</b> account for <b>AXIS</b>.</p>` +
    `<p>` +
    `<a href="${inviteLink}" ` +
    `style="display:inline-block;padding:10px 14px;background:#0b3d2e;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">` +
    `Create Admin Account</a></p>` +
    `<p style="word-break:break-all;color:#334155;margin-top:8px">Or open this link:<br/>${inviteLink}</p>` +
    `<p><b>Expires:</b> ${exp}</p>` +
    `<p style="color:#64748b;font-size:12px">If you did not request this, you may ignore this email.</p>` +
    `</div>`;

  await sendEmail({ to, subject, text, html });
}

module.exports = {
  sendOtpEmail,
  sendAdminInviteEmail,
  sendEmail, // optional export (handy for future emails)
};