import { describe, expect, it } from "vitest";
import { fromKolkata, toKolkataParts } from "@/lib/kolkata";
import {
  generateSlots,
  isAlignedSlot,
  uniqueSlotStarts,
} from "@/lib/slots";
import { reminderWindow } from "@/server/jobs/reminders";
import { UNPAID_TIMEOUT_MS } from "@/server/jobs/unpaid-timeout";

describe("kolkata conversion", () => {
  it("maps 10:00 IST to 04:30 UTC", () => {
    const utc = fromKolkata(2026, 9, 14, 10 * 60);
    expect(utc.toISOString()).toBe("2026-09-14T04:30:00.000Z");
    const parts = toKolkataParts(utc);
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(0);
    expect(parts.weekday).toBe(1);
  });

  it("handles IST midnight crossing the UTC date", () => {
    const utc = fromKolkata(2026, 9, 14, 0);
    expect(utc.toISOString()).toBe("2026-09-13T18:30:00.000Z");
    expect(toKolkataParts(utc).day).toBe(14);
  });
});

describe("generateSlots", () => {
  const monday = fromKolkata(2026, 9, 14, 0);
  const tuesday = fromKolkata(2026, 9, 15, 0);
  const now = fromKolkata(2026, 9, 13, 9 * 60);

  it("emits duration-aligned slots inside an availability window", () => {
    const slots = generateSlots({
      durationMinutes: 60,
      from: monday,
      to: tuesday,
      now,
      windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 13 * 60 }],
      occupied: [],
    });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      fromKolkata(2026, 9, 14, 10 * 60).toISOString(),
      fromKolkata(2026, 9, 14, 11 * 60).toISOString(),
      fromKolkata(2026, 9, 14, 12 * 60).toISOString(),
    ]);
  });

  it("subtracts overlapping bookings for that expert", () => {
    const occupiedStart = fromKolkata(2026, 9, 14, 11 * 60);
    const occupiedEnd = fromKolkata(2026, 9, 14, 12 * 60);
    const slots = generateSlots({
      durationMinutes: 60,
      from: monday,
      to: tuesday,
      now,
      windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 13 * 60 }],
      occupied: [
        { expertId: "e1", startsAt: occupiedStart, endsAt: occupiedEnd },
      ],
    });
    expect(slots.map((s) => toKolkataParts(s.startsAt).hour)).toEqual([10, 12]);
  });

  it("does not hide another expert's slot at the same time", () => {
    const occupiedStart = fromKolkata(2026, 9, 14, 10 * 60);
    const occupiedEnd = fromKolkata(2026, 9, 14, 11 * 60);
    const slots = generateSlots({
      durationMinutes: 60,
      from: monday,
      to: tuesday,
      now,
      windows: [
        { expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 12 * 60 },
        { expertId: "e2", weekday: 1, startMin: 10 * 60, endMin: 12 * 60 },
      ],
      occupied: [
        { expertId: "e1", startsAt: occupiedStart, endsAt: occupiedEnd },
      ],
    });
    const unique = uniqueSlotStarts(slots);
    expect(unique).toHaveLength(2);
    expect(
      slots.filter((s) => s.startsAt.getTime() === occupiedStart.getTime()).map(
        (s) => s.expertId,
      ),
    ).toEqual(["e2"]);
  });

  it("uses 120-minute steps for admission-length sessions", () => {
    const slots = generateSlots({
      durationMinutes: 120,
      from: monday,
      to: tuesday,
      now,
      windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 16 * 60 }],
      occupied: [],
    });
    expect(slots).toHaveLength(3);
    expect(toKolkataParts(slots[0].startsAt).hour).toBe(10);
    expect(toKolkataParts(slots[2].startsAt).hour).toBe(14);
  });

  it("skips slots that have already started", () => {
    const lateNow = fromKolkata(2026, 9, 14, 10 * 60 + 1);
    const slots = generateSlots({
      durationMinutes: 60,
      from: monday,
      to: tuesday,
      now: lateNow,
      windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 12 * 60 }],
      occupied: [],
    });
    expect(slots).toHaveLength(1);
    expect(toKolkataParts(slots[0].startsAt).hour).toBe(11);
  });

  it("treats a 2-hour booking as blocking the overlapping 1-hour slot", () => {
    const slots = generateSlots({
      durationMinutes: 60,
      from: monday,
      to: tuesday,
      now,
      windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 14 * 60 }],
      occupied: [
        {
          expertId: "e1",
          startsAt: fromKolkata(2026, 9, 14, 11 * 60),
          endsAt: fromKolkata(2026, 9, 14, 13 * 60),
        },
      ],
    });
    expect(slots.map((s) => toKolkataParts(s.startsAt).hour)).toEqual([10, 13]);
  });
});

describe("isAlignedSlot", () => {
  it("accepts window start + n * duration", () => {
    const startsAt = fromKolkata(2026, 9, 14, 11 * 60);
    expect(
      isAlignedSlot({
        durationMinutes: 60,
        startsAt,
        windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 13 * 60 }],
      }),
    ).toBe(true);
  });

  it("rejects off-grid times", () => {
    const startsAt = fromKolkata(2026, 9, 14, 10 * 60 + 15);
    expect(
      isAlignedSlot({
        durationMinutes: 60,
        startsAt,
        windows: [{ expertId: "e1", weekday: 1, startMin: 10 * 60, endMin: 13 * 60 }],
      }),
    ).toBe(false);
  });
});

describe("reminderWindow", () => {
  it("does not overlap consecutive cron ticks", () => {
    const first = new Date("2026-09-14T04:00:00.000Z");
    const second = new Date("2026-09-14T04:05:00.000Z");
    const a = reminderWindow(first, null, 24 * 60 * 60 * 1000);
    const b = reminderWindow(second, first, 24 * 60 * 60 * 1000);
    expect(b.from.getTime()).toBe(a.to.getTime());
    expect(b.to.getTime()).toBeGreaterThan(b.from.getTime());
  });
});

describe("unpaid timeout", () => {
  it("is 15 minutes", () => {
    expect(UNPAID_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });
});
