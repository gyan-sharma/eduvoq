/** Asia/Kolkata is UTC+05:30 with no DST. Weekday 0 = Sunday. */
export const KOLKATA_TZ = "Asia/Kolkata";
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const MINUTES_PER_DAY = 24 * 60;

export type KolkataParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  minuteOfDay: number;
};

export function toKolkataParts(date: Date): KolkataParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour,
    minute,
    weekday: shifted.getUTCDay(),
    minuteOfDay: hour * 60 + minute,
  };
}

export function fromKolkata(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, minuteOfDay) - IST_OFFSET_MS);
}

/** Floor an instant to the Asia/Kolkata minute (drop seconds/ms). */
export function normalizeToKolkataMinute(date: Date): Date {
  const parts = toKolkataParts(date);
  return fromKolkata(parts.year, parts.month, parts.day, parts.minuteOfDay);
}

export function startOfKolkataDay(date: Date): Date {
  const p = toKolkataParts(date);
  return fromKolkata(p.year, p.month, p.day, 0);
}

export function addKolkataDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function eachKolkataDate(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfKolkataDay(from);
  const end = to.getTime();
  while (cursor.getTime() < end) {
    days.push(cursor);
    cursor = addKolkataDays(cursor, 1);
  }
  return days;
}

export function formatKolkata(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatted} IST`;
}

export function formatKolkataDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatKolkataTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function kolkataDateKey(date: Date): string {
  const p = toKolkataParts(date);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}
