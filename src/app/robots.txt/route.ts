import { NextResponse } from "next/server";

import { renderRobots } from "@/lib/seo-xml";
import { absoluteUrl, siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body = renderRobots({
    sitemapUrl: absoluteUrl("/sitemap.xml"),
    host: siteUrl().replace(/^https?:\/\//, ""),
    disallow: ["/account", "/admin", "/api/", "/complete-profile"],
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
