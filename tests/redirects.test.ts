import { describe, expect, it } from "vitest";

import redirects from "../redirects.json";

const bySource = new Map(redirects.map((row) => [row.source, row]));

describe("Wix 301 map", () => {
  it("uses 301 for every alias", () => {
    expect(redirects.length).toBeGreaterThan(0);
    for (const row of redirects) {
      expect(row.statusCode).toBe(301);
      expect(row.source.startsWith("/")).toBe(true);
      expect(row.destination.startsWith("/")).toBe(true);
      expect(row.source).not.toBe(row.destination);
    }
  });

  it("has unique sources", () => {
    const sources = redirects.map((row) => row.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("covers architecture aliases", () => {
    const expected: Record<string, string> = {
      "/about-us": "/about",
      "/privacy-policy": "/privacy",
      "/tnc": "/terms",
      "/plans-pricing": "/pricing",
      "/site-map": "/sitemap",
      "/thank-you-page": "/thank-you",
      "/copy-of-cultural-activities": "/services/marketing",
      "/expert-consultation": "/consult",
      "/post/:slug": "/blog/:slug",
      "/submit-your-blog": "/blog/submit",
      "/blog-feed.xml": "/rss.xml",
      "/blog/hashtags/:slug": "/blog/tags/:slug",
      "/settings": "/account/settings",
      "/notifications": "/account/notifications",
      "/followers": "/account/network",
      "/forum-posts": "/forum",
      "/service-page": "/consult",
      "/product-page": "/store",
      "/event-details": "/events",
      "/group": "/groups",
      "/blank-1": "/",
      "/copy-of-home": "/",
      "/schedule": "/",
      "/learning-material": "/resources/learning-material",
      "/class-notes": "/resources/class-notes",
      "/category/all-products": "/store",
      "/product-page/:slug": "/store/products/:slug",
      "/cart-page": "/cart",
      "/event-list": "/events",
      "/event-details/:slug": "/events/:slug",
      "/my-wallet": "/account/wallet",
      "/account/my-wallet": "/account/wallet",
      "/my-account": "/account",
      "/account/my-account": "/account",
      "/my-bookings": "/account/bookings",
      "/social-network": "/community",
      "/group/:slug": "/groups/:slug",
      "/profile/:username/profile": "/members/:username",
      "/chalknpencil": "/",
      "/chalknpencil/:path*": "/:path*",
    };

    for (const [source, destination] of Object.entries(expected)) {
      expect(bySource.get(source)?.destination).toBe(destination);
    }
  });
});
