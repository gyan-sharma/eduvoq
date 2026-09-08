import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function issueVerificationToken(
  identifier: string,
  ttlMs: number,
): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + ttlMs);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });
  return token;
}

export async function consumeVerificationToken(
  token: string,
): Promise<{ identifier: string } | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: row.identifier, token: row.token } },
  });
  if (row.expires.getTime() < Date.now()) return null;
  return { identifier: row.identifier };
}

export function emailFromIdentifier(identifier: string, prefix: string): string | null {
  if (!identifier.startsWith(prefix)) return null;
  return identifier.slice(prefix.length);
}

export const VERIFY_EMAIL_PREFIX = "verify-email:";
export const RESET_PASSWORD_PREFIX = "reset-password:";
export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;
