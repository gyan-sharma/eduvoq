import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimitAuthPaths } from "@/lib/rate-limit";

const PROTECTED = [
  /^\/account(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/resources(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/book(\/|$)/,
  /^\/cart(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/complete-profile(\/|$)/,
];

const ADMIN = [/^\/admin(\/|$)/];

const AUTH_PAGES = [
  /^\/login(\/|$)/,
  /^\/register(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/verify-email(\/|$)/,
  /^\/api\/auth(\/|$)/,
];

const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const limited = rateLimitAuthPaths(req);
  if (limited) return limited;

  if (PROTECTED.some((r) => r.test(pathname)) && !session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const skipPending =
    AUTH_PAGES.some((r) => r.test(pathname)) ||
    pathname.startsWith("/complete-profile");
  if (session?.user.status === "PENDING_PROFILE" && !skipPending) {
    return NextResponse.redirect(new URL("/complete-profile", req.nextUrl));
  }

  if (
    ADMIN.some((r) => r.test(pathname)) &&
    session?.user.role !== "ADMIN" &&
    session?.user.role !== "STAFF"
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export default proxy;
export { proxy };

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/complete-profile",
    "/api/auth/:path*",
    "/account",
    "/account/:path*",
    "/admin",
    "/admin/:path*",
    "/resources",
    "/resources/:path*",
    "/notifications",
    "/notifications/:path*",
    "/book",
    "/book/:path*",
    "/community",
    "/community/:path*",
    "/groups",
    "/groups/:path*",
    "/cart",
    "/cart/:path*",
    "/checkout",
    "/checkout/:path*",
  ],
};
