import { NextResponse, type NextRequest } from "next/server";
import { getClientIpFromHeaders } from "@/lib/request-ip";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function consume(
  key: string,
  capacity: number,
  refillPerMs: number,
): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current) {
    if (buckets.size > MAX_KEYS) {
      for (const [k, v] of buckets) {
        if (now - v.updatedAt > 15 * 60_000) buckets.delete(k);
      }
    }
    buckets.set(key, { tokens: capacity - 1, updatedAt: now });
    return true;
  }
  const refilled = Math.min(
    capacity,
    current.tokens + (now - current.updatedAt) * refillPerMs,
  );
  if (refilled < 1) {
    current.tokens = refilled;
    current.updatedAt = now;
    return false;
  }
  current.tokens = refilled - 1;
  current.updatedAt = now;
  return true;
}

function limitFor(pathname: string): { capacity: number; refillPerMin: number } | null {
  if (pathname.startsWith("/api/auth")) {
    return { capacity: 40, refillPerMin: 60 };
  }
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password"
  ) {
    return { capacity: 10, refillPerMin: 10 };
  }
  return null;
}

/** In-memory IP token bucket. v1 is a single replica; use Redis if we add more. */
export function rateLimitAuthPaths(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const spec = limitFor(pathname);
  if (!spec) return null;
  const ip = getClientIpFromHeaders(req.headers);
  const ok = consume(
    `${ip}:${pathname.startsWith("/api/auth") ? "/api/auth" : pathname}`,
    spec.capacity,
    spec.refillPerMin / 60_000,
  );
  if (ok) return null;
  return new NextResponse("Too many requests", {
    status: 429,
    headers: { "Retry-After": "30" },
  });
}

const resetWindows = new Map<string, number[]>();

/** Password-reset: 5 / hour / email (in-memory, single replica). */
export function allowPasswordResetForEmail(email: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const stamps = (resetWindows.get(email) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= 5) {
    resetWindows.set(email, stamps);
    return false;
  }
  stamps.push(now);
  resetWindows.set(email, stamps);
  return true;
}
