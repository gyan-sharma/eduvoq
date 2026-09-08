import { prisma } from "@/server/db";

export type EventListItem = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isOnline: boolean;
  capacity: number | null;
  pricePaise: number;
  registered: number;
};

export type EventView = EventListItem & {
  descriptionJson: unknown;
  published: boolean;
};

function toListItem(
  row: {
    id: string;
    slug: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    isOnline: boolean;
    capacity: number | null;
    pricePaise: number;
  },
  registered: number,
): EventListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    isOnline: row.isOnline,
    capacity: row.capacity,
    pricePaise: row.pricePaise,
    registered,
  };
}

export async function listPublishedEvents(): Promise<EventListItem[]> {
  try {
    const rows = await prisma.event.findMany({
      where: { published: true },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { registrations: true } } },
    });
    return rows.map((row) => toListItem(row, row._count.registrations));
  } catch {
    return [];
  }
}

export async function getPublishedEventBySlug(
  slug: string,
): Promise<EventView | null> {
  try {
    const row = await prisma.event.findFirst({
      where: { slug, published: true },
      include: { _count: { select: { registrations: true } } },
    });
    if (!row) return null;
    return {
      ...toListItem(row, row._count.registrations),
      descriptionJson: row.descriptionJson,
      published: row.published,
    };
  } catch {
    return null;
  }
}

export function eventJsonLd(event: EventView) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt?.toISOString(),
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    location: event.isOnline
      ? { "@type": "VirtualLocation", url: `/events/${event.slug}` }
      : {
          "@type": "Place",
          name: event.location ?? "India",
        },
    offers: {
      "@type": "Offer",
      price: (event.pricePaise / 100).toFixed(0),
      priceCurrency: "INR",
      availability:
        event.capacity != null && event.registered >= event.capacity
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
    },
    organizer: {
      "@type": "Organization",
      name: "EduVoq",
    },
  };
}
