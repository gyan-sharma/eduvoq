import { CronJobName, SubscriptionStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/server/db";
import { withCronLease } from "@/server/jobs/lease";
import { runBookingReminders } from "@/server/jobs/reminders";
import { runUnpaidTimeout } from "@/server/jobs/unpaid-timeout";

export type CronJobResult =
  | { status: "skipped" }
  | { status: "ran"; detail: Record<string, number | string> }
  | { status: "error"; error: string };

async function runSubExpiry(): Promise<{ expired: number }> {
  const result = await prisma.subscription.updateMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lt: new Date() },
    },
    data: { status: SubscriptionStatus.EXPIRED },
  });
  return { expired: result.count };
}

export async function runCronJobs(): Promise<Record<CronJobName, CronJobResult>> {
  const results = {} as Record<CronJobName, CronJobResult>;

  const reminders = await withCronLease(CronJobName.REMINDERS, (lastRunAt) =>
    runBookingReminders(lastRunAt),
  );
  results.REMINDERS = reminders.skipped
    ? { status: "skipped" }
    : { status: "ran", detail: reminders.result };

  const unpaid = await withCronLease(CronJobName.UNPAID_TIMEOUT, () =>
    runUnpaidTimeout(),
  );
  results.UNPAID_TIMEOUT = unpaid.skipped
    ? { status: "skipped" }
    : { status: "ran", detail: unpaid.result };

  const expiry = await withCronLease(CronJobName.SUB_EXPIRY, () => runSubExpiry());
  results.SUB_EXPIRY = expiry.skipped
    ? { status: "skipped" }
    : { status: "ran", detail: expiry.result };

  const digest = await withCronLease(CronJobName.DIGEST, async () => ({
    sent: 0,
  }));
  results.DIGEST = digest.skipped
    ? { status: "skipped" }
    : { status: "ran", detail: digest.result };

  logger.info({ results }, "cron jobs finished");
  return results;
}
