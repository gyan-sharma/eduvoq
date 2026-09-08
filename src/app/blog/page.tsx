import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { PostList } from "@/components/post-list";
import { Button } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/site";
import { listPublishedBlogPosts, listPublicTaxonomy } from "@/server/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blogs & Articles",
  description:
    "Blogs and articles for school teachers from EduVoq — pedagogy, boards, and classroom practice.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": absoluteUrl("/rss.xml") },
  },
  openGraph: {
    title: "Blogs & Articles",
    description:
      "Blogs and articles for school teachers from EduVoq — pedagogy, boards, and classroom practice.",
    url: absoluteUrl("/blog"),
    type: "website",
  },
};

export default async function BlogIndexPage() {
  const [posts, taxonomy] = await Promise.all([
    listPublishedBlogPosts(),
    listPublicTaxonomy(),
  ]);

  return (
    <MarketingPage
      title="Blogs & Articles"
      description="Writing for school teachers: classroom practice, boards, and the policy that actually reaches period 3."
    >
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/blog/submit">Submit a post</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="/rss.xml">RSS feed</a>
        </Button>
      </div>
      {taxonomy.categories.length > 0 ? (
        <p className="mb-8 text-sm text-muted-foreground">
          Categories:{" "}
          {taxonomy.categories.map((category, index) => (
            <span key={category.slug}>
              {index > 0 ? ", " : null}
              <Link
                href={`/blog/categories/${category.slug}`}
                className="font-medium text-primary hover:underline"
              >
                {category.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      <PostList posts={posts} />
    </MarketingPage>
  );
}
