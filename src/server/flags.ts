import { FLAG_DEFAULTS } from "@/lib/flags";
import { prisma } from "@/server/db";

export async function isFlagEnabled(
  key: string,
  defaultEnabled = FLAG_DEFAULTS[key] ?? false,
): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  if (!row) return defaultEnabled;
  return row.enabled;
}

export async function listKnownFlags(): Promise<
  Array<{ key: string; enabled: boolean; fromDb: boolean }>
> {
  const rows = await prisma.featureFlag.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row.enabled]));
  return Object.keys(FLAG_DEFAULTS).map((key) => ({
    key,
    enabled: byKey.get(key) ?? FLAG_DEFAULTS[key] ?? false,
    fromDb: byKey.has(key),
  }));
}
