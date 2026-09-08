import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsBody } from "@/components/cms-body";
import { EventRegisterForm } from "@/components/events/register-form";
import { JsonLd } from "@/components/json-ld";
import { MarketingPage } from "@/components/marketing-page";
import {
  eventRegistrationStatus,
  remainingCapacity,
} from "@/lib/events";
import { formatKolkata } from "@/lib/kolkata";
import { formatInrPaise } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { eventJsonLd, getPublishedEventBySlug } from "@/server/events";
import { isFlagEnabled } from "@/server/flags";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);
  if (!event) return { title: "Event" };
  return {
    title: `${event.title} | EduVoq`,
    description: `${formatKolkata(event.startsAt)}${event.isOnline ? " · Online" : ""}`,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: event.title,
      url: absoluteUrl(`/events/${event.slug}`),
      type: "website",
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);
  if (!event) notFound();

  const user = await requireSession().catch(() => null);
  const registrationEnabled = await isFlagEnabled("events_registration");
  let alreadyRegistered = false;
  if (user) {
    const row = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    alreadyRegistered = Boolean(row);
  }

  const remaining = remainingCapacity(event.capacity, event.registered);
  const decision = eventRegistrationStatus({
    published: event.published,
    registrationEnabled,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: event.capacity,
    registered: event.registered,
    alreadyRegistered,
    pricePaise: event.pricePaise,
  });

  return (
    <MarketingPage title={event.title}>
      <JsonLd data={eventJsonLd(event)} />
      <p className="text-sm text-muted-foreground">
        <Link href="/events" className="text-primary hover:underline">
          ← Events
        </Link>
      </p>
      <p className="mt-4 text-base text-foreground/90">
        {formatKolkata(event.startsAt)}
        {event.endsAt ? ` – ${formatKolkata(event.endsAt)}` : ""}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {event.isOnline ? "Online" : event.location ?? "Location to be confirmed"}
        {event.location && event.isOnline ? ` · ${event.location}` : ""}
      </p>
      <p className="mt-2 text-sm">
        {event.pricePaise > 0 ? formatInrPaise(event.pricePaise) : "Free"}
        {remaining === 0
          ? " · Full"
          : remaining != null
            ? ` · ${remaining} seats left`
            : ""}
      </p>
      <div className="mt-6">
        <CmsBody body={event.descriptionJson} />
      </div>
      <div className="mt-8">
        {alreadyRegistered ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            You are registered for this event.
          </p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">
            <Link href={`/login?callbackUrl=/events/${event.slug}`} className="text-primary hover:underline">
              Log in
            </Link>{" "}
            to register.
          </p>
        ) : decision.ok ? (
          <EventRegisterForm eventId={event.id} />
        ) : (
          <p className="text-sm text-muted-foreground">{decision.error}</p>
        )}
      </div>
    </MarketingPage>
  );
}
