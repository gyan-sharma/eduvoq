import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role, UserStatus } from "@prisma/client";
import { BookForm } from "@/components/consult/book-form";
import { addKolkataDays } from "@/lib/kolkata";
import { formatDurationMinutes, formatInrPaise } from "@/lib/money";
import { jsonPlainText } from "@/lib/tiptap-text";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";
import { requireSession } from "@/server/rbac";
import { listPublicSlots, SLOT_HORIZON_DAYS } from "@/server/slots";

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
    select: { title: true },
  });
  return { title: service ? `Book ${service.title}` : "Book consultation" };
}

export default async function BookPage({ params }: { params: Promise<Params> }) {
  const user = await requireSession().catch(() => null);
  if (!user) {
    const { slug } = await params;
    redirect(`/login?callbackUrl=/book/${slug}`);
  }
  if (user.status !== UserStatus.ACTIVE) {
    redirect("/account");
  }
  if (user.role === Role.STUDENT) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold text-stone-900">Booking</h1>
        <p className="mt-3 text-sm text-stone-600">
          Student accounts cannot book consultations. Ask a parent or guardian
          to book from their account.
        </p>
      </div>
    );
  }

  const { slug } = await params;
  const enabled = await isFlagEnabled("bookings");
  const service = await prisma.consultationService.findFirst({
    where: { slug, isActive: true },
  });
  if (!service) notFound();

  const now = new Date();
  const slots = enabled
    ? await listPublicSlots(
        service,
        now,
        addKolkataDays(now, SLOT_HORIZON_DAYS),
        now,
      )
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link
          href={`/consult/${service.slug}`}
          className="text-emerald-800 hover:underline"
        >
          ← {service.title}
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
        Book {service.title}
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        {formatDurationMinutes(service.durationMinutes)} ·{" "}
        {formatInrPaise(service.pricePaise)} · {jsonPlainText(service.descriptionJson)}
      </p>
      {!enabled ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Online booking is paused.
        </p>
      ) : (
        <div className="mt-8">
          <BookForm serviceSlug={service.slug} slots={slots} />
        </div>
      )}
    </div>
  );
}
