import { BookingStatus } from "@prisma/client";
import { PAYMENT_HOLD_MS } from "@/lib/payments/gateway";
import { releaseExpiredPendingOrders } from "@/server/commerce";
import { prisma } from "@/server/db";
import { allowReleaseExpiredPayment } from "@/server/payments";

export const UNPAID_TIMEOUT_MS = PAYMENT_HOLD_MS;

export async function runUnpaidTimeout(now = new Date()): Promise<{
  bookingsDeleted: number;
  ordersCancelled: number;
}> {
  const cutoff = new Date(now.getTime() - UNPAID_TIMEOUT_MS);

  const pending = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      createdAt: { lt: cutoff },
    },
    select: { id: true, razorpayOrderId: true },
  });
  let bookingsDeleted = 0;
  for (const row of pending) {
    if (!(await allowReleaseExpiredPayment(row.razorpayOrderId))) continue;
    const deleted = await prisma.booking.deleteMany({
      where: { id: row.id, status: BookingStatus.PENDING_PAYMENT },
    });
    bookingsDeleted += deleted.count;
  }

  const ordersCancelled = await releaseExpiredPendingOrders(now);

  return {
    bookingsDeleted,
    ordersCancelled,
  };
}
