import nodemailer from "nodemailer";

import { config } from "../config.js";

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass);
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  await transport.sendMail({
    from: config.smtpFrom,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
  });
}
