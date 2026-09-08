import { randomBytes } from "node:crypto";

/** Opaque id compatible with Prisma `@default(cuid())` columns. */
export function newId(): string {
  return `c${randomBytes(16).toString("hex")}`.slice(0, 25);
}
