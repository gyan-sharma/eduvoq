import Link from "next/link";

import { formatDateIst } from "@/lib/dates";
import type { PostListItem, PostTaxonomy } from "@/server/posts";

export function TaxonomyLinks({
  items,
  base,
}: {
  items: PostTaxonomy[];
  base: "/blog/tags" | "/blog/categories";
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={`${base}-${item.slug}`}>
          <Link
            href={`${base}/${item.slug}`}
            className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PostList({
  posts,
  empty = "No posts have been published yet.",
}: {
  posts: PostListItem[];
  empty?: string;
}) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-8">
      {posts.map((post) => (
        <li key={post.id} className="border-b border-border pb-8 last:border-0">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            <Link href={`/blog/${post.slug}`} className="hover:underline">
              {post.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateIst(post.publishedAt) ?? "Draft date pending"}
            {post.authorName ? ` · ${post.authorName}` : ""}
          </p>
          <p className="mt-3 text-base leading-7">{post.excerpt}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <TaxonomyLinks items={post.categories} base="/blog/categories" />
            <TaxonomyLinks items={post.tags} base="/blog/tags" />
          </div>
        </li>
      ))}
    </ul>
  );
}
