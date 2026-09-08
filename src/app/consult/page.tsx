import type { Metadata } from "next";
import Link from "next/link";
import { formatDurationMinutes, formatInrPaise } from "@/lib/money";
import { jsonPlainText } from "@/lib/tiptap-text";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Expert consultation",
  description:
    "Book career counselling, psychology, or admission consulting with EduVoq experts.",
};

export default async function ConsultIndexPage() {
  const enabled = await isFlagEnabled("bookings");
  const services = await prisma.consultationService.findMany({
    where: { isActive: true },
    orderBy: { pricePaise: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-800">
        Consulting services
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
        Expert consultation
      </h1>
      <p className="mt-3 max-w-2xl text-stone-600">
        One-to-one sessions for educators, parents, and students. Times are in
        Asia/Kolkata. Online by default — a meeting link is added once the
        expert confirms.
      </p>
      {!enabled ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Online booking is paused. Email hello@eduvoq.com to request a session.
        </p>
      ) : null}

      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <li key={service.id}>
            <Link
              href={`/consult/${service.slug}`}
              className="flex h-full flex-col rounded-xl border border-stone-200 bg-white p-6 shadow-sm hover:border-emerald-800"
            >
              <h2 className="text-lg font-semibold text-stone-900">
                {service.title}
              </h2>
              <p className="mt-2 flex-1 text-sm text-stone-600">
                {jsonPlainText(service.descriptionJson)}
              </p>
              <p className="mt-4 text-sm text-stone-700">
                {formatDurationMinutes(service.durationMinutes)}
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-900">
                {formatInrPaise(service.pricePaise)}
              </p>
              <span className="mt-4 text-sm font-medium text-emerald-800">
                View details →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-stone-600">
        Want to consult as an expert? Write to{" "}
        <a className="text-emerald-800 hover:underline" href="mailto:hello@eduvoq.com">
          hello@eduvoq.com
        </a>
        . Expert access is granted by EduVoq staff.
      </p>
    </main>
  );
}
