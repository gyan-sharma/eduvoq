import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingPage } from "@/components/marketing-page";
import { PostList } from "@/components/post-list";
import { absoluteUrl } from "@/lib/site";
import { getPublishedCategory } from "@/server/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getPublishedCategory(slug);
  if (!category) return { title: "Category" };
  const title =
    category.slug === "e-magazine"
      ? "E-magazine"
      : category.name;
  const description =
    category.slug === "e-magazine"
      ? "EduVoq e-magazine: longer staffroom writing for school teachers."
      : `Posts in ${category.name} on EduVoq.`;
  return {
    title,
    description,
    alternates: { canonical: `/blog/categories/${category.slug}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/blog/categories/${category.slug}`),
      type: "website",
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getPublishedCategory(slug);
  if (!category) notFound();

  const isEmagazine = category.slug === "e-magazine";

  return (
    <MarketingPage
      title={isEmagazine ? "E-magazine" : category.name}
      description={
        isEmagazine
          ? "Longer staffroom writing — practice, not press releases."
          : `Published posts filed under ${category.name}.`
      }
    >
      <PostList
        posts={category.posts}
        empty={`No published posts in ${category.name} yet.`}
      />
      <p className="mt-10 text-sm">
        <Link href="/blog" className="font-medium text-primary hover:underline">
          ← All posts
        </Link>
      </p>
    </MarketingPage>
  );
}
