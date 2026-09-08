import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/cron-auth";

const original = process.env.CRON_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("cronAuthorized", () => {
  it("rejects when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer anything" },
    });
    expect(cronAuthorized(request)).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    expect(cronAuthorized(request)).toBe(true);
  });

  it("rejects a mismatched token of the same length", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer test-cron-secreX" },
    });
    expect(cronAuthorized(request)).toBe(false);
  });
});
