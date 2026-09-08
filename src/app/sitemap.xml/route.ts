import { NextResponse } from "next/server";

import { toIsoDate } from "@/lib/dates";
import { marketingSitemapPaths } from "@/lib/public-paths";
import { renderUrlSet, type SitemapUrl } from "@/lib/seo-xml";
import { absoluteUrl } from "@/lib/site";
import { listPublishedEvents } from "@/server/events";
import {
  listPublishedPosts,
  listPublicTaxonomy,
} from "@/server/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [posts, taxonomy, events] = await Promise.all([
    listPublishedPosts(),
    listPublicTaxonomy(),
    listPublishedEvents(),
  ]);

  const urls: SitemapUrl[] = [
    ...marketingSitemapPaths().map((path): SitemapUrl => ({
      loc: absoluteUrl(path),
      changefreq: path === "/blog" ? "daily" : "weekly",
      priority: path === "/" ? 1 : path.startsWith("/blog") ? 0.8 : 0.6,
    })),
    ...taxonomy.categories.map((category) => ({
      loc: absoluteUrl(`/blog/categories/${category.slug}`),
      changefreq: "weekly" as const,
      priority: 0.6,
    })),
    ...taxonomy.tags.map((tag) => ({
      loc: absoluteUrl(`/blog/tags/${tag.slug}`),
      changefreq: "weekly" as const,
      priority: 0.5,
    })),
    ...posts.map((post) => ({
      loc: absoluteUrl(`/blog/${post.slug}`),
      lastmod: toIsoDate(post.updatedAt ?? post.publishedAt),
      changefreq: "monthly" as const,
      priority: 0.7,
    })),
    ...events.map((event) => ({
      loc: absoluteUrl(`/events/${event.slug}`),
      lastmod: toIsoDate(event.startsAt),
      changefreq: "weekly" as const,
      priority: 0.6,
    })),
  ];

  return new NextResponse(renderUrlSet(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=600",
    },
  });
}
