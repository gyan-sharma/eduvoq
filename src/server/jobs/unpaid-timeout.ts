import { BookingStatus } from "@prisma/client";
import { PAYMENT_HOLD_MS } from "@/lib/payments/gateway";
import { releaseExpiredPendingOrders } from "@/server/commerce";
import { prisma } from "@/server/db";

export const UNPAID_TIMEOUT_MS = PAYMENT_HOLD_MS;

export async function runUnpaidTimeout(now = new Date()): Promise<{
  bookingsDeleted: number;
  ordersCancelled: number;
}> {
  const cutoff = new Date(now.getTime() - UNPAID_TIMEOUT_MS);

  const bookings = await prisma.booking.deleteMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      createdAt: { lt: cutoff },
    },
  });

  const ordersCancelled = await releaseExpiredPendingOrders(now);

  return {
    bookingsDeleted: bookings.count,
    ordersCancelled,
  };
}
