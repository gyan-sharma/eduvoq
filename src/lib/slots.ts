import {
  eachKolkataDate,
  fromKolkata,
  toKolkataParts,
} from "@/lib/kolkata";

export type AvailabilityWindow = {
  expertId: string;
  weekday: number;
  startMin: number;
  endMin: number;
};

export type OccupiedInterval = {
  expertId: string;
  startsAt: Date;
  endsAt: Date;
};

export type GeneratedSlot = {
  expertId: string;
  startsAt: Date;
  endsAt: Date;
};

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function generateSlots(input: {
  durationMinutes: number;
  from: Date;
  to: Date;
  now: Date;
  windows: AvailabilityWindow[];
  occupied: OccupiedInterval[];
}): GeneratedSlot[] {
  const duration = input.durationMinutes;
  if (duration <= 0 || input.to <= input.from) return [];

  const windowsByWeekday = new Map<number, AvailabilityWindow[]>();
  for (const window of input.windows) {
    const list = windowsByWeekday.get(window.weekday);
    if (list) list.push(window);
    else windowsByWeekday.set(window.weekday, [window]);
  }

  const occupiedByExpert = new Map<string, OccupiedInterval[]>();
  for (const interval of input.occupied) {
    const list = occupiedByExpert.get(interval.expertId);
    if (list) list.push(interval);
    else occupiedByExpert.set(interval.expertId, [interval]);
  }

  const slots: GeneratedSlot[] = [];
  for (const day of eachKolkataDate(input.from, input.to)) {
    const parts = toKolkataParts(day);
    const windows = windowsByWeekday.get(parts.weekday) ?? [];
    for (const window of windows) {
      if (window.endMin - window.startMin < duration) continue;
      for (
        let minute = window.startMin;
        minute + duration <= window.endMin;
        minute += duration
      ) {
        const startsAt = fromKolkata(parts.year, parts.month, parts.day, minute);
        const endsAt = fromKolkata(
          parts.year,
          parts.month,
          parts.day,
          minute + duration,
        );
        if (startsAt < input.now) continue;
        if (startsAt < input.from || startsAt >= input.to) continue;
        const busy = occupiedByExpert.get(window.expertId) ?? [];
        const taken = busy.some((interval) =>
          intervalsOverlap(startsAt, endsAt, interval.startsAt, interval.endsAt),
        );
        if (taken) continue;
        slots.push({ expertId: window.expertId, startsAt, endsAt });
      }
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}

export function uniqueSlotStarts(
  slots: GeneratedSlot[],
): Array<{ startsAt: Date; endsAt: Date }> {
  const seen = new Map<number, { startsAt: Date; endsAt: Date }>();
  for (const slot of slots) {
    const key = slot.startsAt.getTime();
    if (!seen.has(key)) {
      seen.set(key, { startsAt: slot.startsAt, endsAt: slot.endsAt });
    }
  }
  return [...seen.values()];
}

export function isAlignedSlot(input: {
  durationMinutes: number;
  startsAt: Date;
  windows: AvailabilityWindow[];
  expertId?: string;
}): boolean {
  const parts = toKolkataParts(input.startsAt);
  return input.windows.some((window) => {
    if (input.expertId && window.expertId !== input.expertId) return false;
    if (window.weekday !== parts.weekday) return false;
    if (parts.minuteOfDay < window.startMin) return false;
    if (parts.minuteOfDay + input.durationMinutes > window.endMin) return false;
    return (parts.minuteOfDay - window.startMin) % input.durationMinutes === 0;
  });
}
