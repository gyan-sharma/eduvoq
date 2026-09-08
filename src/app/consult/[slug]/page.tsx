import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { formatDurationMinutes, formatInrPaise } from "@/lib/money";
import { jsonPlainText } from "@/lib/tiptap-text";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await prisma.consultationService.findUnique({
    where: { slug },
    select: { title: true, descriptionJson: true },
  });
  if (!service) return { title: "Consultation" };
  return {
    title: service.title,
    description: jsonPlainText(service.descriptionJson).slice(0, 160),
  };
}

export default async function ConsultDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [service, enabled, session] = await Promise.all([
    prisma.consultationService.findFirst({
      where: { slug, isActive: true },
    }),
    isFlagEnabled("bookings"),
    auth(),
  ]);
  if (!service) notFound();

  const bookHref = `/book/${service.slug}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(bookHref)}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link href="/consult" className="text-emerald-800 hover:underline">
          ← All consultations
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
        {service.title}
      </h1>
      <p className="mt-3 text-stone-600">{jsonPlainText(service.descriptionJson)}</p>
      <dl className="mt-6 grid gap-2 text-sm text-stone-700">
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Duration</dt>
          <dd className="font-medium">
            {formatDurationMinutes(service.durationMinutes)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Fee</dt>
          <dd className="font-medium">{formatInrPaise(service.pricePaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Mode</dt>
          <dd className="font-medium">
            {service.mode === "ONLINE" ? "Online" : service.mode.replace(/_/g, " ")}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Timezone</dt>
          <dd className="font-medium">Asia/Kolkata</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {enabled ? (
          <Link
            href={session?.user ? bookHref : loginHref}
            className={`${buttonClass} w-auto`}
          >
            {session?.user ? "Book a slot" : "Log in to book"}
          </Link>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Online booking is paused. Email hello@eduvoq.com.
          </p>
        )}
        <Link href="/consult" className={`${secondaryButtonClass} w-auto`}>
          Other services
        </Link>
      </div>
    </main>
  );
}
