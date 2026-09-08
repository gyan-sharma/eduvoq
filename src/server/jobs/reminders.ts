import { BookingStatus, NotificationType } from "@prisma/client";
import { sendBookingReminderEmail } from "@/lib/email";
import { formatKolkata } from "@/lib/kolkata";
import { logger } from "@/lib/logger";
import { prisma } from "@/server/db";

const HOUR_MS = 60 * 60 * 1000;
const LOOKBACK_CAP_MS = 15 * 60 * 1000;

export function reminderWindow(
  now: Date,
  lastRunAt: Date | null,
  horizonMs: number,
  lookbackCapMs = LOOKBACK_CAP_MS,
): { from: Date; to: Date } {
  const cap = new Date(now.getTime() - lookbackCapMs);
  const watermark = lastRunAt && lastRunAt > cap ? lastRunAt : cap;
  return {
    from: new Date(watermark.getTime() + horizonMs),
    to: new Date(now.getTime() + horizonMs),
  };
}

function reminderHref(bookingId: string, horizon: "24h" | "1h"): string {
  return `/account/bookings?id=${bookingId}&r=${horizon}`;
}

async function sendHorizon(
  now: Date,
  lastRunAt: Date | null,
  horizon: "24h" | "1h",
): Promise<number> {
  const horizonMs = horizon === "24h" ? 24 * HOUR_MS : HOUR_MS;
  const { from, to } = reminderWindow(now, lastRunAt, horizonMs);
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startsAt: { gt: from, lte: to },
    },
    include: {
      service: { select: { title: true } },
      customer: { select: { id: true, email: true } },
    },
  });
  if (bookings.length === 0) return 0;

  const hrefs = bookings.map((row) => reminderHref(row.id, horizon));
  const already = await prisma.notification.findMany({
    where: {
      type: NotificationType.BOOKING,
      href: { in: hrefs },
    },
    select: { href: true },
  });
  const sent = new Set(already.map((row) => row.href));

  let count = 0;
  for (const booking of bookings) {
    const href = reminderHref(booking.id, horizon);
    if (sent.has(href)) continue;
    const email = booking.customer.email;
    if (!email) continue;
    const whenLabel = formatKolkata(booking.startsAt);
    try {
      await sendBookingReminderEmail({
        to: email,
        title: booking.service.title,
        whenLabel,
        meetingUrl: booking.meetingUrl,
        horizon,
      });
      await prisma.notification.create({
        data: {
          userId: booking.customer.id,
          type: NotificationType.BOOKING,
          title:
            horizon === "24h"
              ? "Consultation in 24 hours"
              : "Consultation starting soon",
          body: `${booking.service.title} at ${whenLabel}`,
          href,
        },
      });
      count += 1;
    } catch (error) {
      logger.error({ err: error, bookingId: booking.id, horizon }, "reminder send failed");
    }
  }
  return count;
}

export async function runBookingReminders(lastRunAt: Date | null): Promise<{
  sent24h: number;
  sent1h: number;
}> {
  const now = new Date();
  const sent24h = await sendHorizon(now, lastRunAt, "24h");
  const sent1h = await sendHorizon(now, lastRunAt, "1h");
  return { sent24h, sent1h };
}
