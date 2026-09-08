import { prisma } from "@/server/db";

const DEFAULTS: Record<string, boolean> = {
  registrations: true,
  student_self_register: false,
  community: true,
  forum: true,
  commerce: true,
  commerce_physical: true,
  bookings: true,
  wallet_spend: false,
  ai_assistants: false,
  events_registration: true,
};

export async function isFlagEnabled(
  key: string,
  defaultEnabled = DEFAULTS[key] ?? false,
): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  if (!row) return defaultEnabled;
  return row.enabled;
}
