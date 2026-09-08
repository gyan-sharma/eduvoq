import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { siteUrl } from "@/lib/site";

export function appUrl(): string {
  return siteUrl();
}

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  // Dev always logs the body so Mailpit-less setups can still grab verify/reset links.
  if (process.env.NODE_ENV !== "production") {
    logger.info({ to, subject, text }, "email");
  }

  const host = process.env.SMTP_HOST;
  if (!host) {
    logger.warn({ to, subject }, "SMTP_HOST unset; email not sent");
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "hello@eduvoq.com",
    to,
    subject,
    text,
  });
}

export async function sendVerifyEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Verify your EduVoq email",
    text: `Welcome to EduVoq.\n\nConfirm your email by opening this link:\n${url}\n\nIf you did not create an account, ignore this message.`,
  });
}

export async function sendResetEmail(to: string, token: string): Promise<void> {
  const url = `${appUrl()}/forgot-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Reset your EduVoq password",
    text: `Reset your password by opening this link (valid for 1 hour):\n${url}\n\nIf you did not request a reset, ignore this message.`,
  });
}
