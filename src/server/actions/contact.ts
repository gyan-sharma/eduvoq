"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import {
  getTurnstileSecretKey,
  getTurnstileSiteKey,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { contactSchema } from "@/lib/validators/contact";
import { prisma } from "@/server/db";

export type ContactState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string>>;
} | null;

function fieldErrorsFromZod(
  error: ZodError,
): NonNullable<ContactState>["fieldErrors"] {
  const fieldErrors: NonNullable<ContactState>["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "email" || key === "message") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const honeypot = String(formData.get("website") ?? "");
  // Silent success so bots that fill hidden fields cannot calibrate.
  if (honeypot.trim() !== "") {
    redirect("/thank-you");
  }

  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const siteKey = getTurnstileSiteKey();
  const secret = getTurnstileSecretKey();
  if (siteKey || secret) {
    const token = String(
      formData.get("cf-turnstile-response") ??
        formData.get("turnstileToken") ??
        "",
    );
    const ok = await verifyTurnstileToken(token);
    if (!ok) {
      return { error: "Please complete the verification challenge." };
    }
  }

  const { name, email, message } = parsed.data;
  const to = process.env.CONTACT_TO || "hello@eduvoq.com";

  let stored = false;
  try {
    await prisma.contactMessage.create({
      data: {
        kind: "contact",
        name,
        email,
        payload: { message, to },
      },
    });
    stored = true;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("[contact] failed to store message");
      return {
        error:
          "Could not send your message. Email hello@eduvoq.com instead.",
      };
    }
    console.info("[contact] database unavailable; logging instead", error);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[contact] email skipped (no SMTP in this PR)", {
      to,
      name,
      email,
      message,
      stored,
    });
  }

  redirect("/thank-you");
}
