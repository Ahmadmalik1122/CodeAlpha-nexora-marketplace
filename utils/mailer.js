// Email sending via Gmail SMTP (nodemailer).
// Requires GMAIL_USER + GMAIL_APP_PASSWORD (a 16-char Google "App Password",
// not your normal Gmail password — generate one at myaccount.google.com/apppasswords,
// which needs 2-Step Verification turned on for the account first).
const nodemailer = require('nodemailer');

let transporter = null;
let warned = false;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

// Returns true if the email was actually sent, false if mail isn't configured
// (caller decides how to degrade — e.g. dev fallback).
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    if (!warned) {
      console.warn('[mailer] GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will not be sent.');
      warned = true;
    }
    return false;
  }
  const from = process.env.MAIL_FROM || `Nexora Marketplace <${process.env.GMAIL_USER}>`;
  await t.sendMail({ from, to, subject, html, text });
  return true;
}

function resetPasswordEmail({ resetUrl }) {
  const subject = 'Reset your Nexora Marketplace password';
  const text = `We received a request to reset your Nexora Marketplace password.\n\n`
    + `Reset it here (valid for 1 hour): ${resetUrl}\n\n`
    + `If you didn't request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
      <div style="font-size:20px;font-weight:800;margin-bottom:16px">⚡ Nexora Marketplace</div>
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p style="line-height:1.5">We received a request to reset the password on your account. This link is valid for <b>1 hour</b>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Reset Password</a>
      </p>
      <p style="line-height:1.5;color:#6b7280;font-size:14px">If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color:#2563eb">${resetUrl}</a></p>
      <p style="line-height:1.5;color:#6b7280;font-size:14px">If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
    </div>`;
  return { subject, text, html };
}

module.exports = { sendMail, resetPasswordEmail };
