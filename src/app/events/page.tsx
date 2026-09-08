import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { remainingCapacity } from "@/lib/events";
import { formatKolkata } from "@/lib/kolkata";
import { formatInrPaise } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { listPublishedEvents } from "@/server/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events | EduVoq",
  description:
    "Workshops, webinars, and educator gatherings from EduVoq. Times in Asia/Kolkata.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Events | EduVoq",
    description:
      "Workshops, webinars, and educator gatherings from EduVoq. Times in Asia/Kolkata.",
    url: absoluteUrl("/events"),
    type: "website",
  },
};

export default async function EventsPage() {
  const events = await listPublishedEvents();

  return (
    <MarketingPage
      title="Events"
      description="Workshops and webinars for school teachers. Staff publish events here — we do not ship placeholder listings."
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events are listed yet. Check back, or email{" "}
          <a className="font-medium text-primary hover:underline" href="mailto:hello@eduvoq.com">
            hello@eduvoq.com
          </a>
          .
        </p>
      ) : (
        <ul className="grid gap-4">
          {events.map((event) => {
            const remaining = remainingCapacity(event.capacity, event.registered);
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="block rounded-xl border border-border bg-card p-5 hover:border-primary"
                >
                  <h2 className="font-heading text-lg font-semibold">{event.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatKolkata(event.startsAt)}
                    {event.isOnline ? " · Online" : event.location ? ` · ${event.location}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    {event.pricePaise > 0 ? formatInrPaise(event.pricePaise) : "Free"}
                    {remaining === 0
                      ? " · Full"
                      : remaining != null
                        ? ` · ${remaining} seats left`
                        : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </MarketingPage>
  );
}
