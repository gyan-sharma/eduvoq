import { BookingStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db";

export const UNPAID_TIMEOUT_MS = 15 * 60 * 1000;

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

  const orders = await prisma.order.updateMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lt: cutoff } }],
    },
    data: { status: OrderStatus.CANCELLED },
  });

  return {
    bookingsDeleted: bookings.count,
    ordersCancelled: orders.count,
  };
}
