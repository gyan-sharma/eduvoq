import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

export function appUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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

export async function sendBookingCreatedEmail(input: {
  to: string;
  title: string;
  whenLabel: string;
  meetingUrl: string | null;
  expertName: string | null;
}): Promise<void> {
  const meeting = input.meetingUrl
    ? `Meeting link: ${input.meetingUrl}`
    : "Your expert will share a meeting link before the session.";
  const expert = input.expertName ? `\nExpert: ${input.expertName}` : "";
  await sendEmail({
    to: input.to,
    subject: `Booking recorded: ${input.title}`,
    text: `Your EduVoq consultation is held for 15 minutes pending payment.\n\n${input.title}\nWhen: ${input.whenLabel}${expert}\n${meeting}\n\nManage bookings: ${appUrl()}/account/bookings\n\nPayment confirmation lands in a later release; unpaid holds expire after 15 minutes.`,
  });
}

export async function sendBookingReminderEmail(input: {
  to: string;
  title: string;
  whenLabel: string;
  meetingUrl: string | null;
  horizon: "24h" | "1h";
}): Promise<void> {
  const heading =
    input.horizon === "24h"
      ? "Your consultation is in 24 hours."
      : "Your consultation starts in about an hour.";
  const meeting = input.meetingUrl
    ? `Join: ${input.meetingUrl}`
    : "The meeting link will be on your bookings page if the expert has set one.";
  await sendEmail({
    to: input.to,
    subject:
      input.horizon === "24h"
        ? `Reminder: ${input.title} tomorrow`
        : `Starting soon: ${input.title}`,
    text: `${heading}\n\n${input.title}\nWhen: ${input.whenLabel}\n${meeting}\n\n${appUrl()}/account/bookings`,
  });
}

export async function sendExpertBookingEmail(input: {
  to: string;
  title: string;
  whenLabel: string;
  customerName: string | null;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `New consultation: ${input.title}`,
    text: `A member booked ${input.title}.\n\nWhen: ${input.whenLabel}\nCustomer: ${input.customerName ?? "Member"}\n\nAdd a meeting URL from Account → Bookings.`,
  });
}
