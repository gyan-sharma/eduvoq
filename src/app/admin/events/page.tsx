import type { Metadata } from "next";
import Link from "next/link";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass } from "@/components/auth/ui";
import { formatKolkata } from "@/lib/kolkata";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Events | Admin" };

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Events
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Staff-created events only. Do not import Wix boilerplate copy.
          </p>
        </div>
        <Link href="/admin/events/new" className={`${buttonClass} w-auto`}>
          New event
        </Link>
      </div>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {events.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">
          No events yet. Create one with real EduVoq copy.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/events/${event.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-emerald-800"
              >
                <p className="font-medium text-stone-900">{event.title}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {formatKolkata(event.startsAt)} ·{" "}
                  {event.published ? "Published" : "Draft"} ·{" "}
                  {event._count.registrations} registered
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
