import { prisma } from "@/server/db";
import { randomBytes } from "node:crypto";

function slugBase(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split("@")[0] || "user")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (source.slice(0, 24) || "user");
}

/** Unique username generated BEFORE User insert (adapter events.createUser is too late). */
export async function generateUsername(
  name?: string | null,
  email?: string | null,
): Promise<string> {
  const base = slugBase(name, email);
  for (let i = 0; i < 12; i += 1) {
    const username = `${base}${randomBytes(2).toString("hex")}`.slice(0, 32);
    const taken = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!taken) return username;
  }
  return `user${randomBytes(8).toString("hex")}`.slice(0, 32);
}
