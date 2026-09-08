import { describe, expect, it } from "vitest";
import {
  adultGateError,
  ageYears,
  isAtLeast18,
  parseIsoDate,
} from "@/lib/age";

describe("ageYears", () => {
  it("returns 18 on the 18th birthday", () => {
    const dob = new Date(Date.UTC(2008, 2, 1));
    const now = new Date(Date.UTC(2026, 2, 1));
    expect(ageYears(dob, now)).toBe(18);
    expect(isAtLeast18(dob, now)).toBe(true);
    expect(adultGateError(dob, now)).toBeNull();
  });

  it("returns 17 the day before the 18th birthday", () => {
    const dob = new Date(Date.UTC(2008, 2, 1));
    const now = new Date(Date.UTC(2026, 1, 28));
    expect(ageYears(dob, now)).toBe(17);
    expect(isAtLeast18(dob, now)).toBe(false);
    expect(adultGateError(dob, now)).toMatch(/Ask a parent/i);
  });

  it("treats a leap-day birthday as 18 on 1 March in a non-leap year", () => {
    const dob = new Date(Date.UTC(2008, 1, 29));
    const dayBefore = new Date(Date.UTC(2026, 1, 28));
    const marchFirst = new Date(Date.UTC(2026, 2, 1));
    expect(ageYears(dob, dayBefore)).toBe(17);
    expect(isAtLeast18(dob, dayBefore)).toBe(false);
    expect(ageYears(dob, marchFirst)).toBe(18);
    expect(isAtLeast18(dob, marchFirst)).toBe(true);
  });
});

describe("parseIsoDate", () => {
  it("accepts a valid calendar date", () => {
    const parsed = parseIsoDate("2008-03-01");
    expect(parsed?.toISOString().startsWith("2008-03-01")).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("08-03-01")).toBeNull();
  });
});
