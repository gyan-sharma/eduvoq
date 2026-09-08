import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingStatus, Role } from "@prisma/client";
import {
  CancelBookingButton,
  CompleteBookingButton,
  MeetingUrlForm,
} from "@/components/consult/booking-actions";
import { AvailabilityForm } from "@/components/consult/availability-form";
import { successClass } from "@/components/auth/ui";
import { PayBookingForm } from "@/components/payments/pay-form";
import { formatKolkata } from "@/lib/kolkata";
import { formatInrPaise } from "@/lib/money";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My bookings",
};

function statusLabel(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.PENDING_PAYMENT:
      return "Pending payment";
    case BookingStatus.CONFIRMED:
      return "Confirmed";
    case BookingStatus.CANCELLED:
      return "Cancelled";
    case BookingStatus.COMPLETED:
      return "Completed";
    case BookingStatus.NO_SHOW:
      return "No-show";
    default:
      return status;
  }
}

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; paid?: string; cancelled?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/bookings");

  const { booked, paid, cancelled } = await searchParams;
  const asExpert = user.role === Role.EXPERT || user.role === Role.STAFF || user.role === Role.ADMIN;

  const [mine, assigned, windows] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id },
      include: {
        service: { select: { title: true, slug: true, pricePaise: true } },
        expert: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
    asExpert
      ? prisma.booking.findMany({
          where: { expertId: user.id },
          include: {
            service: { select: { title: true, slug: true, pricePaise: true } },
            customer: { select: { name: true, email: true } },
          },
          orderBy: { startsAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    user.role === Role.EXPERT
      ? prisma.expertAvailability.findMany({
          where: { expertId: user.id },
          orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        My bookings
      </h1>
      {booked ? (
        <p className={`${successClass} mt-4`}>
          Booking recorded. Complete payment within 15 minutes to keep the slot.
        </p>
      ) : null}
      {paid ? (
        <p className={`${successClass} mt-4`}>
          If you already paid, confirmed sessions appear below after the webhook.
        </p>
      ) : null}
      {cancelled ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Checkout was cancelled. Pending bookings can be paid again below.
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-stone-900">Sessions you booked</h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            No consultations yet.{" "}
            <Link href="/consult" className="text-emerald-800 hover:underline">
              Browse services
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {mine.map((booking) => (
              <li
                key={booking.id}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <p className="font-semibold text-stone-900">
                  {booking.service.title}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {formatKolkata(booking.startsAt)} · {statusLabel(booking.status)} ·{" "}
                  {formatInrPaise(booking.service.pricePaise)}
                </p>
                {booking.expert.name ? (
                  <p className="mt-1 text-sm text-stone-600">
                    Expert: {booking.expert.name}
                  </p>
                ) : null}
                {booking.meetingUrl ? (
                  <p className="mt-2 text-sm">
                    <a
                      className="text-emerald-800 hover:underline"
                      href={booking.meetingUrl}
                    >
                      Join meeting
                    </a>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-stone-500">
                    Meeting link appears here when the expert adds it.
                  </p>
                )}
                {booking.status === BookingStatus.PENDING_PAYMENT ? (
                  <div className="mt-4 grid gap-4">
                    <PayBookingForm bookingId={booking.id} />
                    <CancelBookingButton bookingId={booking.id} />
                  </div>
                ) : booking.status === BookingStatus.CONFIRMED ? (
                  <div className="mt-4">
                    <CancelBookingButton bookingId={booking.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === Role.EXPERT ? (
        <section className="mt-12 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Weekly availability (IST)
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Slots are generated from these windows minus existing bookings.
          </p>
          <div className="mt-4">
            <AvailabilityForm initial={windows} />
          </div>
        </section>
      ) : null}

      {asExpert && user.role === Role.EXPERT ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-stone-900">Assigned to you</h2>
          {assigned.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">No assigned sessions.</p>
          ) : (
            <ul className="mt-4 grid gap-4">
              {assigned.map((booking) => (
                <li
                  key={booking.id}
                  className="rounded-xl border border-stone-200 bg-white p-5"
                >
                  <p className="font-semibold text-stone-900">
                    {booking.service.title}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {formatKolkata(booking.startsAt)} · {statusLabel(booking.status)}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {booking.customer.name} ({booking.customer.email})
                  </p>
                  <div className="mt-4 grid gap-4">
                    <MeetingUrlForm
                      bookingId={booking.id}
                      current={booking.meetingUrl}
                    />
                    {booking.status === BookingStatus.CONFIRMED ? (
                      <CompleteBookingButton bookingId={booking.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
