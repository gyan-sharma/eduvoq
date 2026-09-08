import type { Metadata } from "next";
import { BookingStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { formatKolkata } from "@/lib/kolkata";
import { formatInrPaise } from "@/lib/money";
import { adminUpdateBooking } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Bookings | Admin" };

function statusLabel(status: BookingStatus): string {
  return status.replace(/_/g, " ");
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const bookings = await prisma.booking.findMany({
    orderBy: { startsAt: "desc" },
    take: 100,
    include: {
      service: { select: { title: true, pricePaise: true } },
      expert: { select: { name: true, email: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Bookings
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Times shown in Asia/Kolkata. Complete, no-show, or cancel from here.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {bookings.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No bookings yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="font-medium text-stone-900">{booking.service.title}</p>
              <p className="mt-1 text-sm text-stone-600">
                {formatKolkata(booking.startsAt)} · {statusLabel(booking.status)} ·{" "}
                {formatInrPaise(booking.service.pricePaise)}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {booking.customer.name ?? booking.customer.email} with{" "}
                {booking.expert.name ?? booking.expert.email}
              </p>
              {booking.status === BookingStatus.CONFIRMED ||
              booking.status === BookingStatus.PENDING_PAYMENT ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.status === BookingStatus.CONFIRMED ? (
                    <>
                      <form action={adminUpdateBooking}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="decision" value="complete" />
                        <button className={`${buttonClass} w-auto`} type="submit">
                          Complete
                        </button>
                      </form>
                      <form action={adminUpdateBooking}>
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <input type="hidden" name="decision" value="no_show" />
                        <button className={`${secondaryButtonClass} w-auto`} type="submit">
                          No-show
                        </button>
                      </form>
                    </>
                  ) : null}
                  <form action={adminUpdateBooking}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="decision" value="cancel" />
                    <button className={`${secondaryButtonClass} w-auto`} type="submit">
                      Cancel
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
