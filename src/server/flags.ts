import {
  ENV_AI_ASSISTANTS,
  FLAG_AI_ASSISTANTS,
  FLAG_DEFAULTS,
  parseEnvBool,
} from "@/lib/flags";
import { prisma } from "@/server/db";

export async function isFlagEnabled(
  key: string,
  defaultEnabled = FLAG_DEFAULTS[key] ?? false,
): Promise<boolean> {
  if (
    key === FLAG_AI_ASSISTANTS &&
    parseEnvBool(process.env[ENV_AI_ASSISTANTS]) === true
  ) {
    return true;
  }
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  if (!row) return defaultEnabled;
  return row.enabled;
}

/** Alias used by the optional xAI module. */
export async function isFeatureEnabled(
  key: string,
  defaultEnabled = FLAG_DEFAULTS[key] ?? false,
): Promise<boolean> {
  return isFlagEnabled(key, defaultEnabled);
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
