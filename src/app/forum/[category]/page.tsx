import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { NewThreadForm } from "@/components/forum/new-thread-form";
import { ThreadRow } from "@/components/forum/thread-row";
import {
  canPostInForum,
  formatForumDay,
  forumAuthorSelect,
  forumAuthorView,
  paginationCursor,
} from "@/lib/forum";
import { DemoForumCategory } from "@/components/demo/demo-forum";
import { getDemoForumCategory } from "@/lib/demo-content";
import { excerptFromDoc } from "@/lib/rich-text";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

async function loadCategory(slug: string) {
  return prisma.forumCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Forum" };
  return {
    title: category.name,
    description: category.description ?? `${category.name} on EduVoq Forums`,
  };
}

export default async function ForumCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { category: slug } = await params;
  const { cursor } = await searchParams;
  if (await isDemoMode()) {
    const demo = getDemoForumCategory(slug);
    if (demo) {
      return (
        <DemoForumCategory
          slug={demo.slug}
          name={demo.name}
          description={demo.description}
        />
      );
    }
  }
  const category = await loadCategory(slug);
  if (!category) notFound();

  const viewer = await getSessionUser();
  const canPost = canPostInForum(viewer);
  const cursorRow = cursor
    ? await prisma.forumThread.findFirst({
        where: { id: cursor, categoryId: category.id },
        select: { id: true },
      })
    : null;
  const pageCursor = paginationCursor(cursor, cursorRow?.id);
  const listQuery = {
    where: { categoryId: category.id },
    take: PAGE_SIZE + 1,
    orderBy: [
      { pinned: "desc" as const },
      { createdAt: "desc" as const },
      { id: "desc" as const },
    ],
    include: {
      author: { select: forumAuthorSelect },
      _count: { select: { posts: true } },
      posts: {
        orderBy: { createdAt: "asc" as const },
        take: 1,
        select: { bodyJson: true },
      },
    },
  };
  let rows;
  try {
    rows = await prisma.forumThread.findMany({
      ...listQuery,
      ...(pageCursor ? { skip: 1, cursor: { id: pageCursor } } : {}),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      rows = await prisma.forumThread.findMany(listQuery);
    } else {
      throw error;
    }
  }

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/forum" className="text-primary hover:underline">
          ← Forums
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
        {category.name}
      </h1>
      {category.description ? (
        <p className="mt-3 text-muted-foreground">{category.description}</p>
      ) : null}

      <div className="mt-8">
        <NewThreadForm
          categories={[{ slug: category.slug, name: category.name }]}
          defaultCategorySlug={category.slug}
          signedIn={Boolean(viewer)}
          canPost={canPost}
          callbackUrl={`/forum/${category.slug}`}
        />
      </div>

      {page.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No threads in this category yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {page.map((thread) => (
            <li key={thread.id}>
              <ThreadRow
                href={`/forum/${category.slug}/${thread.slug}`}
                title={thread.title}
                excerpt={excerptFromDoc(thread.posts[0]?.bodyJson)}
                author={forumAuthorView(thread.author, viewer)}
                when={formatForumDay(thread.createdAt)}
                replyCount={thread._count.posts}
                pinned={thread.pinned}
                locked={thread.locked}
              />
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <p className="mt-8">
          <Link
            href={`/forum/${category.slug}?cursor=${encodeURIComponent(nextCursor)}`}
            className="font-medium text-primary hover:underline"
          >
            Next page
          </Link>
        </p>
      ) : null}
    </section>
  );
}
