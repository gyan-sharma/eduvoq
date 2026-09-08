import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/flash";
import { EventForm } from "@/components/admin/event-form";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Edit event | Admin" };

export default async function AdminEditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Edit {event.title}
      </h1>
      {event.published ? (
        <p className="mt-1 text-sm">
          <Link href={`/events/${event.slug}`} className="text-emerald-800 hover:underline">
            Public page
          </Link>
        </p>
      ) : null}
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      <div className="mt-6 max-w-2xl">
        <EventForm event={event} />
      </div>
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-stone-900">
          Registrations ({event.registrations.length})
        </h2>
        {event.registrations.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {event.registrations.map((row) => (
              <li key={row.id} className="px-4 py-2 text-sm text-stone-700">
                {row.user.name ?? row.user.email} · {row.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
