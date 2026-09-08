import type { Metadata } from "next";
import { PostKind, PostStatus } from "@prisma/client";

import {
  blogCategories,
  blogPostBySlug,
  blogPosts,
  blogTags,
  type BlogPostSeed,
} from "@/content/blog";
import { toIsoDate } from "@/lib/dates";
import { absoluteUrl } from "@/lib/site";
import { prisma } from "@/server/db";

export type PostTaxonomy = { slug: string; name: string };

export type PostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  authorName: string;
  categories: PostTaxonomy[];
  tags: PostTaxonomy[];
};

export type PostView = PostListItem & {
  bodyJson: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date | null;
  kind: PostKind;
};

export type StaffPostView = PostView & {
  status: PostStatus;
  authorEmail: string;
};

const SEED_AUTHOR = "EduVoq Editorial";

const postListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  updatedAt: true,
  seoTitle: true,
  seoDescription: true,
  bodyJson: true,
  kind: true,
  author: { select: { name: true, username: true } },
  categories: {
    include: { category: { select: { slug: true, name: true } } },
  },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
} as const;

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  bodyJson: unknown;
  kind: PostKind;
  author: { name: string | null; username: string | null };
  categories: { category: PostTaxonomy }[];
  tags: { tag: PostTaxonomy }[];
};

function authorName(author: { name: string | null; username: string | null }) {
  return author.name?.trim() || author.username || "EduVoq";
}

function toView(row: PostRow): PostView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    bodyJson: row.bodyJson,
    kind: row.kind,
    authorName: authorName(row.author),
    categories: row.categories.map((item) => item.category),
    tags: row.tags.map((item) => item.tag),
  };
}

function taxonomyName(
  slug: string,
  table: { slug: string; name: string }[],
): string {
  return table.find((row) => row.slug === slug)?.name ?? slug;
}

function fromSeed(post: BlogPostSeed): PostView {
  const publishedAt = new Date(post.publishedAt);
  return {
    id: `seed:${post.slug}`,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt,
    updatedAt: publishedAt,
    seoTitle: post.seoTitle ?? null,
    seoDescription: post.seoDescription ?? null,
    bodyJson: post.bodyJson,
    kind: post.kind === "EMAGAZINE" ? PostKind.EMAGAZINE : PostKind.BLOG,
    authorName: SEED_AUTHOR,
    categories: post.categorySlugs.map((slug) => ({
      slug,
      name: taxonomyName(slug, blogCategories),
    })),
    tags: post.tagSlugs.map((slug) => ({
      slug,
      name: taxonomyName(slug, blogTags),
    })),
  };
}

function seedPublished(kind?: PostKind): PostView[] {
  return blogPosts
    .map(fromSeed)
    .filter((post) => (kind ? post.kind === kind : true))
    .sort((a, b) => {
      const aTime = a.publishedAt?.getTime() ?? 0;
      const bTime = b.publishedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
}

async function queryPublished(kind?: PostKind): Promise<PostView[] | null> {
  try {
    const rows = await prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        ...(kind ? { kind } : { kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] } }),
      },
      orderBy: { publishedAt: "desc" },
      select: postListSelect,
    });
    return rows.map((row) => toView(row as PostRow));
  } catch {
    return null;
  }
}

export async function listPublishedBlogPosts(): Promise<PostListItem[]> {
  const rows = await queryPublished(PostKind.BLOG);
  return rows ?? seedPublished(PostKind.BLOG);
}

export async function listPublishedPosts(): Promise<PostView[]> {
  const rows = await queryPublished();
  return rows ?? seedPublished();
}

export async function getPostByIdForStaff(
  id: string,
): Promise<StaffPostView | null> {
  const row = await prisma.post.findUnique({
    where: { id },
    select: {
      ...postListSelect,
      status: true,
      author: { select: { name: true, username: true, email: true } },
    },
  });
  if (!row) return null;
  return {
    ...toView(row as PostRow),
    status: row.status,
    authorEmail: row.author.email,
  };
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostView | null> {
  try {
    const row = await prisma.post.findFirst({
      where: {
        slug,
        status: PostStatus.PUBLISHED,
        kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] },
      },
      select: postListSelect,
    });
    if (row) return toView(row as PostRow);
  } catch {
    const seed = blogPostBySlug[slug];
    return seed ? fromSeed(seed) : null;
  }
  return null;
}

export async function getPublishedCategory(
  slug: string,
): Promise<{ slug: string; name: string; posts: PostListItem[] } | null> {
  try {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { slug: true, name: true },
    });
    if (!category) return null;
    const rows = await prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] },
        categories: { some: { category: { slug } } },
      },
      orderBy: { publishedAt: "desc" },
      select: postListSelect,
    });
    return {
      slug: category.slug,
      name: category.name,
      posts: rows.map((row) => toView(row as PostRow)),
    };
  } catch {
    const seed = blogCategories.find((item) => item.slug === slug);
    if (!seed) return null;
    return {
      slug: seed.slug,
      name: seed.name,
      posts: seedPublished().filter((post) =>
        post.categories.some((item) => item.slug === slug),
      ),
    };
  }
}

export async function getPublishedTag(
  slug: string,
): Promise<{ slug: string; name: string; posts: PostListItem[] } | null> {
  try {
    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: { slug: true, name: true },
    });
    if (!tag) return null;
    const rows = await prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] },
        tags: { some: { tag: { slug } } },
      },
      orderBy: { publishedAt: "desc" },
      select: postListSelect,
    });
    return {
      slug: tag.slug,
      name: tag.name,
      posts: rows.map((row) => toView(row as PostRow)),
    };
  } catch {
    const seed = blogTags.find((item) => item.slug === slug);
    if (!seed) return null;
    return {
      slug: seed.slug,
      name: seed.name,
      posts: seedPublished().filter((post) =>
        post.tags.some((item) => item.slug === slug),
      ),
    };
  }
}

export async function listPublicTaxonomy(): Promise<{
  categories: PostTaxonomy[];
  tags: PostTaxonomy[];
}> {
  try {
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({
        where: {
          posts: {
            some: {
              post: {
                status: PostStatus.PUBLISHED,
                kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] },
              },
            },
          },
        },
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.tag.findMany({
        where: {
          posts: {
            some: {
              post: {
                status: PostStatus.PUBLISHED,
                kind: { in: [PostKind.BLOG, PostKind.EMAGAZINE] },
              },
            },
          },
        },
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { categories, tags };
  } catch {
    return { categories: blogCategories, tags: blogTags };
  }
}

export function postMetadata(post: PostView): Metadata {
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "EduVoq",
      locale: "en_IN",
      publishedTime: toIsoDate(post.publishedAt),
      modifiedTime: toIsoDate(post.updatedAt),
      authors: post.authorName ? [post.authorName] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function postJsonLd(post: PostView) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    datePublished: toIsoDate(post.publishedAt),
    dateModified: toIsoDate(post.updatedAt),
    author: {
      "@type": "Person",
      name: post.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "EduVoq",
      url: absoluteUrl("/"),
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}
