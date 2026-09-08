"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { ConsentType, Role, UserStatus } from "@prisma/client";
import { signIn, signOut, unstable_update } from "@/auth";
import { prisma } from "@/server/db";
import { requireRole, requireSession, revokeSessions } from "@/server/rbac";
import { adultGateError, ageYears, MIN_ADULT_AGE, parseIsoDate } from "@/lib/age";
import { sendResetEmail, sendVerifyEmail } from "@/lib/email";
import { STUDENT_SELF_REGISTER, TOS_VERSION } from "@/lib/flags";
import { hashPassword } from "@/lib/password";
import { allowPasswordResetForEmail } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/request-ip";
import {
  consumeVerificationToken,
  emailFromIdentifier,
  issueVerificationToken,
  RESET_PASSWORD_PREFIX,
  RESET_PASSWORD_TTL_MS,
  VERIFY_EMAIL_PREFIX,
  VERIFY_EMAIL_TTL_MS,
} from "@/lib/tokens";
import { generateUsername } from "@/lib/username";
import {
  completeProfileSchema,
  createChildSchema,
  linkCredentialsSchema,
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";

export type AuthActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function formFlag(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

async function clientIp(): Promise<string> {
  return getClientIpFromHeaders(await headers());
}

export async function registerWithCredentials(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: String(formData.get("password") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    tos: formFlag(formData.get("tos")),
    isParent: formFlag(formData.get("isParent")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const dob = parseIsoDate(parsed.data.dateOfBirth);
  if (!dob) return { error: "Enter a valid date of birth." };
  const gate = adultGateError(dob);
  if (gate) return { error: gate };

  if (!STUDENT_SELF_REGISTER && formData.get("role") === "STUDENT") {
    return { error: "Students cannot self-register. Ask a parent to create your account." };
  }

  const email = parsed.data.email;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const username = await generateUsername(parsed.data.name, email);
  const role = parsed.data.isParent ? Role.PARENT : Role.EDUCATOR;
  const ip = await clientIp();

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      username,
      role,
      status: UserStatus.PENDING_VERIFICATION,
      dateOfBirth: dob,
    },
  });

  await prisma.consent.create({
    data: {
      userId: user.id,
      type: ConsentType.TOS,
      version: TOS_VERSION,
      ip,
    },
  });

  const token = await issueVerificationToken(
    `${VERIFY_EMAIL_PREFIX}${email}`,
    VERIFY_EMAIL_TTL_MS,
  );
  await sendVerifyEmail(email, token);

  return {
    ok: true,
    message: "Check your email for a verification link. (Locally, see Mailpit or the server log.)",
  };
}

export async function loginWithCredentials(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const callbackUrl = String(formData.get("callbackUrl") || "/account");
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Invalid email or password, or the account is not yet verified."
            : "Unable to sign in.",
      };
    }
    throw error;
  }
}

export async function oauthSignIn(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "");
  const redirectTo = String(formData.get("redirectTo") || "/account");
  const allowed = new Set(["google", "apple", "facebook", "linkedin"]);
  if (!allowed.has(provider)) {
    redirect("/login?error=Configuration");
  }
  await signIn(provider, { redirectTo });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function completeProfile(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");
  if (user.status !== UserStatus.PENDING_PROFILE) {
    redirect("/account");
  }

  const parsed = completeProfileSchema.safeParse({
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    tos: formFlag(formData.get("tos")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const dob = parseIsoDate(parsed.data.dateOfBirth);
  if (!dob) return { error: "Enter a valid date of birth." };
  const age = ageYears(dob);
  if (age < 0 || age > 120) {
    return { error: "Enter a valid date of birth." };
  }
  if (age < MIN_ADULT_AGE) {
    // Free the email so a parent can create a STUDENT with this address.
    await prisma.user.delete({ where: { id: user.id } });
    await signOut({ redirectTo: "/register?error=NeedParent" });
    return {
      error:
        "You must be 18 or older to create an account. Ask a parent to create your account.",
    };
  }

  const ip = await clientIp();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        dateOfBirth: dob,
        status: UserStatus.ACTIVE,
        emailVerified: user.emailVerified ?? new Date(),
      },
    }),
    prisma.consent.create({
      data: {
        userId: user.id,
        type: ConsentType.TOS,
        version: TOS_VERSION,
        ip,
      },
    }),
  ]);

  await unstable_update({
    user: { status: UserStatus.ACTIVE },
  });

  redirect("/account");
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = requestResetSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const generic = {
    ok: true,
    message: "If that email is registered, we sent a reset link.",
  } as const;

  if (!allowPasswordResetForEmail(parsed.data.email)) {
    return generic;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user?.passwordHash) return generic;

  const token = await issueVerificationToken(
    `${RESET_PASSWORD_PREFIX}${user.email}`,
    RESET_PASSWORD_TTL_MS,
  );
  await sendResetEmail(user.email, token);
  return generic;
}

export async function resetPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const consumed = await consumeVerificationToken(parsed.data.token);
  const email = consumed
    ? emailFromIdentifier(consumed.identifier, RESET_PASSWORD_PREFIX)
    : null;
  if (!email) return { error: "This reset link is invalid or has expired." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "This reset link is invalid or has expired." };

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await revokeSessions(user.id);

  return { ok: true, message: "Password updated. You can sign in with the new password." };
}

export async function verifyEmailToken(token: string): Promise<AuthActionState> {
  const consumed = await consumeVerificationToken(token);
  const email = consumed
    ? emailFromIdentifier(consumed.identifier, VERIFY_EMAIL_PREFIX)
    : null;
  if (!email) return { error: "This verification link is invalid or has expired." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "This verification link is invalid or has expired." };

  if (
    user.status === UserStatus.BANNED ||
    user.status === UserStatus.SUSPENDED
  ) {
    return { error: "This account cannot be activated." };
  }

  if (!user.dateOfBirth) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        status: UserStatus.PENDING_PROFILE,
      },
    });
    return { ok: true, message: "Email verified. Complete your profile to continue." };
  }

  const gate = adultGateError(user.dateOfBirth);
  if (gate) {
    return { error: gate };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      status: UserStatus.ACTIVE,
    },
  });

  return { ok: true, message: "Email verified. You can sign in." };
}

export async function createChildStudent(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parent = await requireRole(Role.PARENT).catch(() => null);
  if (!parent) {
    return { error: "Only a parent account can create a student." };
  }

  const parsed = createChildSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: String(formData.get("password") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    parentFullName: String(formData.get("parentFullName") ?? ""),
    attestation: formFlag(formData.get("attestation")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const dob = parseIsoDate(parsed.data.dateOfBirth);
  if (!dob) return { error: "Enter a valid date of birth." };
  const age = ageYears(dob);
  if (age < 0 || age > 17) {
    return {
      error:
        "Child accounts are for under-18 students. Adults should register themselves.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) return { error: "That email is already in use." };

  const passwordHash = await hashPassword(parsed.data.password);
  const username = await generateUsername(parsed.data.name, parsed.data.email);
  const ip = await clientIp();

  const child = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      username,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      dateOfBirth: dob,
      parentId: parent.id,
      isProfilePublic: false,
      emailVerified: new Date(),
    },
  });

  await prisma.consent.create({
    data: {
      userId: child.id,
      type: ConsentType.PARENTAL_ATTESTATION,
      // Consent has no name column; typed parent name is part of the attestation record.
      version: `${TOS_VERSION}:${parsed.data.parentFullName}`,
      ip,
    },
  });

  return { ok: true, message: `Created student account @${username}.` };
}

export async function linkCredentials(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");
  if (user.status !== UserStatus.ACTIVE) {
    return { error: "Finish your profile before linking a password." };
  }

  const parsed = linkCredentialsSchema.safeParse({
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (user.passwordHash) {
    return { error: "This account already has a password. Use reset if you forgot it." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  return { ok: true, message: "Password added. You can now sign in with email." };
}
