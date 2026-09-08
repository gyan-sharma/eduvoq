import { CronJobName } from "@prisma/client";
import { prisma } from "@/server/db";

/** Overlap lock of 4 minutes; cron is invoked every 5. */
export const CRON_LOCK_MS = 4 * 60 * 1000;

export async function withCronLease<T>(
  job: CronJobName,
  fn: (lastRunAt: Date | null) => Promise<T>,
): Promise<{ skipped: true } | { skipped: false; result: T }> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + CRON_LOCK_MS);

  await prisma.cronLease.upsert({
    where: { job },
    create: { job, lockedUntil: new Date(0) },
    update: {},
  });

  const acquired = await prisma.$executeRaw`
    UPDATE CronLease
    SET lockedUntil = ${lockUntil}
    WHERE job = ${job} AND lockedUntil < ${now}
  `;
  if (acquired === 0) return { skipped: true };

  try {
    const row = await prisma.cronLease.findUnique({ where: { job } });
    const result = await fn(row?.lastRunAt ?? null);
    await prisma.cronLease.update({
      where: { job },
      data: { lastRunAt: now },
    });
    return { skipped: false, result };
  } catch (error) {
    await prisma.cronLease.update({
      where: { job },
      data: { lockedUntil: now },
    });
    throw error;
  }
}
