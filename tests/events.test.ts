import { describe, expect, it } from "vitest";

import {
  assertOriginalEventCopy,
  eventRegistrationStatus,
  isWixBoilerplateEventSlug,
  remainingCapacity,
} from "@/lib/events";
import {
  parseKolkataDateTimeLocal,
  toKolkataDateTimeLocal,
} from "@/lib/kolkata";
import { parseRupeesToPaise } from "@/lib/money";

describe("event copy", () => {
  it("rejects Wix event slugs and lorem", () => {
    expect(isWixBoilerplateEventSlug("annual-science-fair")).toBe(true);
    expect(isWixBoilerplateEventSlug("spring-is-here-field-trip")).toBe(true);
    expect(isWixBoilerplateEventSlug("educator-meetup-delhi")).toBe(false);
    expect(
      assertOriginalEventCopy("annual-science-fair", "A real workshop"),
    ).toMatch(/Wix event slugs/);
    expect(
      assertOriginalEventCopy(
        "educator-meetup",
        "I'm an event description. Click here to add your own.",
      ),
    ).toMatch(/boilerplate/);
    expect(
      assertOriginalEventCopy(
        "educator-meetup-delhi",
        "An in-person meetup for Delhi school teachers.",
      ),
    ).toBeNull();
  });
});

describe("event registration rules", () => {
  const base = {
    published: true,
    registrationEnabled: true,
    startsAt: new Date("2030-01-01T04:30:00.000Z"),
    endsAt: null as Date | null,
    capacity: 2 as number | null,
    registered: 0,
    alreadyRegistered: false,
    pricePaise: 0,
    now: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("allows a free published event with seats", () => {
    expect(eventRegistrationStatus(base)).toEqual({ ok: true });
  });

  it("blocks full, paid, unpublished, ended, and duplicate registrations", () => {
    expect(eventRegistrationStatus({ ...base, registered: 2 }).ok).toBe(false);
    expect(eventRegistrationStatus({ ...base, pricePaise: 50000 }).ok).toBe(false);
    expect(eventRegistrationStatus({ ...base, published: false }).ok).toBe(false);
    expect(eventRegistrationStatus({ ...base, alreadyRegistered: true }).ok).toBe(
      false,
    );
    expect(
      eventRegistrationStatus({
        ...base,
        startsAt: new Date("2020-01-01T00:00:00.000Z"),
        now: new Date("2026-01-01T00:00:00.000Z"),
      }).ok,
    ).toBe(false);
  });

  it("treats null capacity as unlimited", () => {
    expect(remainingCapacity(null, 99)).toBeNull();
    expect(remainingCapacity(10, 3)).toBe(7);
    expect(remainingCapacity(2, 5)).toBe(0);
  });
});

describe("event datetime and price helpers", () => {
  it("round-trips Kolkata datetime-local strings", () => {
    const date = parseKolkataDateTimeLocal("2026-06-15T10:30");
    expect(date).toBeInstanceOf(Date);
    expect(toKolkataDateTimeLocal(date!)).toBe("2026-06-15T10:30");
    expect(parseKolkataDateTimeLocal("nope")).toBeNull();
  });

  it("parses rupees into paise", () => {
    expect(parseRupeesToPaise("10")).toBe(1000);
    expect(parseRupeesToPaise("")).toBe(0);
    expect(parseRupeesToPaise("-1")).toBeNull();
  });
});
