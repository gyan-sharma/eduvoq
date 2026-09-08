export const MIN_ADULT_AGE = 18;

/** Calendar age in full years using UTC date parts (DOB is stored as @db.Date). */
export function ageYears(dob: Date, now = new Date()): number {
  const years = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  const dayDelta = now.getUTCDate() - dob.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    return years - 1;
  }
  return years;
}

export function isAtLeast18(dob: Date, now = new Date()): boolean {
  return ageYears(dob, now) >= MIN_ADULT_AGE;
}

/** Parse an HTML date input (YYYY-MM-DD) as a UTC calendar date. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function adultGateError(dob: Date, now = new Date()): string | null {
  const age = ageYears(dob, now);
  if (age < 0 || age > 120) {
    return "Enter a valid date of birth.";
  }
  if (age < MIN_ADULT_AGE) {
    return "You must be 18 or older to create an account. Ask a parent to create your account.";
  }
  return null;
}
