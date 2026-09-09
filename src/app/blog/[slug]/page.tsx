import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsBody } from "@/components/cms-body";
import { JsonLd } from "@/components/json-ld";
import { MarketingPage } from "@/components/marketing-page";
import { TaxonomyLinks } from "@/components/post-list";
import postCovers from "@/content/post-covers.json";
import { formatDateIst } from "@/lib/dates";
import {
  getPublishedPostBySlug,
  postJsonLd,
  postMetadata,
} from "@/server/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Post" };
  return postMetadata(post);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  return (
    <MarketingPage title={post.title}>
      {postCovers[post.slug as keyof typeof postCovers] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={postCovers[post.slug as keyof typeof postCovers]}
          alt=""
          className="mb-8 max-h-96 w-full rounded-2xl object-cover"
        />
      ) : null}
      <JsonLd data={postJsonLd(post)} />
      <p className="text-sm text-muted-foreground">
        {formatDateIst(post.publishedAt) ?? "Published"}
        {post.authorName ? ` · ${post.authorName}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <TaxonomyLinks items={post.categories} base="/blog/categories" />
        <TaxonomyLinks items={post.tags} base="/blog/tags" />
      </div>
      <p className="mt-6 text-lg text-muted-foreground">{post.excerpt}</p>
      <CmsBody body={post.bodyJson} />
      <p className="mt-10 text-sm">
        <Link href="/blog" className="font-medium text-primary hover:underline">
          ← All posts
        </Link>
      </p>
    </MarketingPage>
  );
}
