import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingPage } from "@/components/marketing-page";
import { PostList } from "@/components/post-list";
import { absoluteUrl } from "@/lib/site";
import { getPublishedTag } from "@/server/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getPublishedTag(slug);
  if (!tag) return { title: "Tag" };
  const title = `Posts tagged ${tag.name}`;
  const description = `EduVoq articles tagged ${tag.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/blog/tags/${tag.slug}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/blog/tags/${tag.slug}`),
      type: "website",
    },
  };
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await getPublishedTag(slug);
  if (!tag) notFound();

  return (
    <MarketingPage
      title={`#${tag.name}`}
      description={`Published posts tagged ${tag.name}.`}
    >
      <PostList
        posts={tag.posts}
        empty={`No published posts tagged ${tag.name} yet.`}
      />
      <p className="mt-10 text-sm">
        <Link href="/blog" className="font-medium text-primary hover:underline">
          ← All posts
        </Link>
      </p>
    </MarketingPage>
  );
}
