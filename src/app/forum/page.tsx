import type { Metadata } from "next";
import Link from "next/link";
import { NewThreadForm } from "@/components/forum/new-thread-form";
import { ThreadRow } from "@/components/forum/thread-row";
import {
  canPostInForum,
  formatForumDay,
  forumAuthorSelect,
  forumAuthorView,
} from "@/lib/forum";
import { DemoForumIndex } from "@/components/demo/demo-forum";
import { excerptFromDoc } from "@/lib/rich-text";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forums",
  description:
    "EduVoq Forums — curriculum, classroom management, pedagogy, and more. Public to read; members post.",
};

export default async function ForumPage() {
  if (await isDemoMode()) return <DemoForumIndex />;
  const viewer = await getSessionUser();
  const canPost = canPostInForum(viewer);
  const [categories, threads] = await Promise.all([
    prisma.forumCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { threads: true } } },
    }),
    prisma.forumThread.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        author: { select: forumAuthorSelect },
        category: { select: { slug: true, name: true } },
        _count: { select: { posts: true } },
        posts: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { bodyJson: true },
        },
      },
    }),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Forums
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A rebuilt educator forum — Wix Forum is gone. Categories stay public;
        starting a thread or reply requires an active member session.
      </p>

      {categories.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          Forum categories have not been seeded yet.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  <Link
                    href={`/forum/${category.slug}`}
                    className="hover:underline"
                  >
                    {category.name}
                  </Link>
                </h2>
                {category.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                ) : null}
                <p className="mt-auto pt-4 text-sm text-muted-foreground">
                  {category._count.threads}{" "}
                  {category._count.threads === 1 ? "thread" : "threads"}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12">
        <NewThreadForm
          categories={categories.map((category) => ({
            slug: category.slug,
            name: category.name,
          }))}
          signedIn={Boolean(viewer)}
          canPost={canPost}
          callbackUrl="/forum"
        />
      </div>

      <h2 className="mt-12 font-heading text-xl font-semibold tracking-tight">
        Recent threads
      </h2>
      {threads.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No threads yet. Be the first to start a conversation.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {threads.map((thread) => (
            <li key={thread.id}>
              <ThreadRow
                href={`/forum/${thread.category.slug}/${thread.slug}`}
                title={thread.title}
                excerpt={excerptFromDoc(thread.posts[0]?.bodyJson)}
                author={forumAuthorView(thread.author, viewer)}
                when={formatForumDay(thread.createdAt)}
                replyCount={thread._count.posts}
                pinned={thread.pinned}
                locked={thread.locked}
                category={{
                  href: `/forum/${thread.category.slug}`,
                  name: thread.category.name,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
