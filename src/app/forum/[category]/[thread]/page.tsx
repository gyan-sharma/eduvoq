import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorByline } from "@/components/forum/author-byline";
import { PostBody } from "@/components/forum/post-body";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReportForm } from "@/components/forum/report-form";
import {
  TARGET_FORUM_POST,
  TARGET_FORUM_THREAD,
  canPostInForum,
  formatForumDate,
  forumAuthorSelect,
  forumAuthorView,
} from "@/lib/forum";
import { DemoForumThread } from "@/components/demo/demo-forum";
import { getDemoForumThread } from "@/lib/demo-content";
import { excerptFromDoc } from "@/lib/rich-text";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

async function loadThread(categorySlug: string, threadSlug: string) {
  const category = await prisma.forumCategory.findUnique({
    where: { slug: categorySlug },
    select: { id: true, slug: true, name: true },
  });
  if (!category) return null;
  const thread = await prisma.forumThread.findUnique({
    where: {
      categoryId_slug: { categoryId: category.id, slug: threadSlug },
    },
    include: {
      author: { select: forumAuthorSelect },
    },
  });
  if (!thread) return null;
  return { category, thread };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; thread: string }>;
}): Promise<Metadata> {
  const { category, thread } = await params;
  const loaded = await loadThread(category, thread);
  if (!loaded) return { title: "Thread" };
  const first = await prisma.forumPost.findFirst({
    where: { threadId: loaded.thread.id, parentId: null },
    orderBy: { createdAt: "asc" },
    select: { bodyJson: true },
  });
  return {
    title: loaded.thread.title,
    description:
      excerptFromDoc(first?.bodyJson, 160) ||
      `${loaded.thread.title} in ${loaded.category.name}`,
  };
}

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ category: string; thread: string }>;
}) {
  const { category: categorySlug, thread: threadSlug } = await params;
  if (await isDemoMode()) {
    const demo = getDemoForumThread(categorySlug, threadSlug);
    if (demo) return <DemoForumThread thread={demo} />;
  }
  const loaded = await loadThread(categorySlug, threadSlug);
  if (!loaded) notFound();
  const { category, thread } = loaded;
  const viewer = await getSessionUser();

  const posts = await prisma.forumPost.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: forumAuthorSelect } },
  });
  const postIds = posts.map((post) => post.id);
  const parentById = new Map(posts.map((post) => [post.id, post]));

  const [reactionRows, mineRows] = await Promise.all([
    postIds.length
      ? prisma.reaction.groupBy({
          by: ["targetId", "emoji"],
          where: { targetType: TARGET_FORUM_POST, targetId: { in: postIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    viewer && postIds.length
      ? prisma.reaction.findMany({
          where: {
            userId: viewer.id,
            targetType: TARGET_FORUM_POST,
            targetId: { in: postIds },
          },
          select: { targetId: true, emoji: true },
        })
      : Promise.resolve([]),
  ]);

  const countsByPost = new Map<string, Record<string, number>>();
  for (const row of reactionRows) {
    const current = countsByPost.get(row.targetId) ?? {};
    current[row.emoji] = row._count._all;
    countsByPost.set(row.targetId, current);
  }
  const mineByPost = new Map<string, string[]>();
  for (const row of mineRows) {
    const current = mineByPost.get(row.targetId) ?? [];
    current.push(row.emoji);
    mineByPost.set(row.targetId, current);
  }

  const canPost = canPostInForum(viewer);
  const signedIn = Boolean(viewer);
  const loginHref =
    signedIn && !canPost
      ? "/complete-profile"
      : `/login?callbackUrl=${encodeURIComponent(
          `/forum/${category.slug}/${thread.slug}`,
        )}`;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/forum" className="text-primary hover:underline">
          Forums
        </Link>
        {" · "}
        <Link
          href={`/forum/${category.slug}`}
          className="text-primary hover:underline"
        >
          {category.name}
        </Link>
      </p>

      <header className="mt-4">
        <div className="flex flex-wrap gap-2 text-xs font-medium tracking-wide uppercase">
          {thread.pinned ? <span className="text-primary">Pinned</span> : null}
          {thread.locked ? (
            <span className="text-muted-foreground">Locked</span>
          ) : null}
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          {thread.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <AuthorByline
            author={forumAuthorView(thread.author, viewer)}
            when={formatForumDate(thread.createdAt)}
          />
          <ReportForm
            targetType={TARGET_FORUM_THREAD}
            targetId={thread.id}
            canPost={canPost}
          />
        </div>
      </header>

      <ol className="mt-8 grid gap-4">
        {posts.map((post) => {
          const parent = post.parentId ? parentById.get(post.parentId) : null;
          const parentAuthor = parent
            ? forumAuthorView(parent.author, viewer)
            : null;
          return (
            <li
              key={post.id}
              id={post.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <AuthorByline
                author={forumAuthorView(post.author, viewer)}
                when={formatForumDate(post.createdAt)}
              />
              {parent && parentAuthor ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  In reply to{" "}
                  <a href={`#${parent.id}`} className="text-primary hover:underline">
                    {parentAuthor.displayName}
                  </a>
                </p>
              ) : null}
              <div className="mt-3">
                <PostBody bodyJson={post.bodyJson} />
              </div>
              <div className="mt-4">
                <ReactionBar
                  postId={post.id}
                  counts={countsByPost.get(post.id) ?? {}}
                  mine={mineByPost.get(post.id) ?? []}
                  canPost={canPost}
                  loginHref={loginHref}
                />
              </div>
              <ReplyForm
                categorySlug={category.slug}
                threadSlug={thread.slug}
                parentId={post.id}
                signedIn={signedIn}
                canPost={canPost}
                locked={thread.locked}
                compact
              />
              <ReportForm
                targetType={TARGET_FORUM_POST}
                targetId={post.id}
                canPost={canPost}
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <ReplyForm
          categorySlug={category.slug}
          threadSlug={thread.slug}
          signedIn={signedIn}
          canPost={canPost}
          locked={thread.locked}
        />
      </div>
    </article>
  );
}
