import type { Metadata } from "next";

import { MarketingPage } from "@/components/marketing-page";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News",
  description:
    "Education news from EduVoq, a networking platform for school teachers.",
};

async function getNewsPosts() {
  try {
    return await prisma.post.findMany({
      where: { kind: "NEWS", status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
      },
    });
  } catch {
    return [];
  }
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function NewsPage() {
  const posts = await getNewsPosts();

  return (
    <MarketingPage
      title="News"
      description="Education news for school teachers. Parents and students are welcome for educational consultations."
    >
      {posts.length === 0 ? (
        <p className="text-muted-foreground">
          No news articles have been published yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((post) => (
            <li key={post.id} className="border-b border-border pb-8 last:border-0">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {post.title}
              </h2>
              {post.publishedAt ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(post.publishedAt)}
                </p>
              ) : null}
              <p className="mt-3 text-base leading-7">{post.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </MarketingPage>
  );
}
