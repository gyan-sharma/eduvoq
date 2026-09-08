import { NextResponse } from "next/server";

import { textFromTipTap } from "@/content/tiptap";
import { toRssDate } from "@/lib/dates";
import { renderRss } from "@/lib/seo-xml";
import { absoluteUrl } from "@/lib/site";
import { listPublishedPosts } from "@/server/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await listPublishedPosts();
  const xml = renderRss(
    {
      title: "EduVoq Blog",
      link: absoluteUrl("/blog"),
      description:
        "Blogs and articles for school teachers from EduVoq — Connecting Educators.",
      language: "en-in",
      selfUrl: absoluteUrl("/rss.xml"),
    },
    posts.map((post) => ({
      title: post.title,
      link: absoluteUrl(`/blog/${post.slug}`),
      description: post.excerpt || textFromTipTap(post.bodyJson).slice(0, 280),
      pubDate: toRssDate(post.publishedAt),
      guid: absoluteUrl(`/blog/${post.slug}`),
      author: post.authorName,
      categories: [
        ...post.categories.map((item) => item.name),
        ...post.tags.map((item) => item.name),
      ],
    })),
  );

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=600",
    },
  });
}
