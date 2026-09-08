import { hash, verify } from "@node-rs/argon2";

// OWASP 2024 minimums for Argon2id (m=19456 KiB, t=2, p=1)
const ARGON2ID = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
