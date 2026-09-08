export const WIX_BOILERPLATE_EVENT_SLUGS = [
  "annual-science-fair",
  "spring-is-here-field-trip",
] as const;

const WIX_EVENT_LOREM = /i['’]m an event description/i;

export function isWixBoilerplateEventSlug(slug: string): boolean {
  return (WIX_BOILERPLATE_EVENT_SLUGS as readonly string[]).includes(slug);
}

export function assertOriginalEventCopy(
  slug: string,
  descriptionText: string,
): string | null {
  if (isWixBoilerplateEventSlug(slug)) {
    return "Do not reuse Wix event slugs; write a real EduVoq event.";
  }
  if (WIX_EVENT_LOREM.test(descriptionText)) {
    return "Replace Wix boilerplate copy with a real event description.";
  }
  return null;
}

export function remainingCapacity(
  capacity: number | null,
  registered: number,
): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - registered);
}

export function isEventOpen(event: {
  startsAt: Date;
  endsAt: Date | null;
  now?: Date;
}): boolean {
  const now = event.now ?? new Date();
  const end = event.endsAt ?? event.startsAt;
  return end.getTime() >= now.getTime();
}

export function eventRegistrationStatus(input: {
  published: boolean;
  registrationEnabled: boolean;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  registered: number;
  alreadyRegistered: boolean;
  pricePaise: number;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  if (!input.published) return { ok: false, error: "Event not found." };
  if (input.alreadyRegistered) {
    return { ok: false, error: "You are already registered." };
  }
  if (!input.registrationEnabled) {
    return { ok: false, error: "Registration is closed." };
  }
  if (!isEventOpen(input)) {
    return { ok: false, error: "This event has ended." };
  }
  const remaining = remainingCapacity(input.capacity, input.registered);
  if (remaining === 0) {
    return { ok: false, error: "This event is full." };
  }
  if (input.pricePaise > 0) {
    return {
      ok: false,
      error:
        "Paid event checkout is not live yet. Email hello@eduvoq.com to register.",
    };
  }
  return { ok: true };
}
