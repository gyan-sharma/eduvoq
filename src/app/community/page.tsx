import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, Role } from "@prisma/client";
import { CommunityNav } from "@/components/community/community-nav";
import { FeedComposer } from "@/components/community/feed-composer";
import { FeedPostCard } from "@/components/community/feed-post-card";
import {
  TARGET_FEED_POST,
  canUseEducatorCommunity,
  FEED_COMMENT_FOCUS,
  FEED_COMMENT_PREVIEW,
  FEED_PAGE_SIZE,
  isCuid,
  tallyReactionsByTarget,
} from "@/lib/community";
import { DemoCommunityPage } from "@/components/demo/demo-community";
import { cn } from "@/lib/utils";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teacher Social",
  description:
    "Social network for educators. Join groups, share thoughts, and interact with other school teachers.",
  robots: { index: false, follow: false },
};

const authorSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
} as const;

const commentAuthorSelect = {
  name: true,
  username: true,
} as const;

function feedInclude(commentTake: number) {
  return {
    author: { select: authorSelect },
    comments: {
      where: { status: "VISIBLE" },
      orderBy: { createdAt: "desc" as const },
      take: commentTake,
      include: { author: { select: commentAuthorSelect } },
    },
    _count: {
      select: { comments: { where: { status: "VISIBLE" } } },
    },
  } satisfies Prisma.FeedPostInclude;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; post?: string; tab?: string }>;
}) {
  if (await isDemoMode()) return <DemoCommunityPage />;
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/community");

  const { cursor, post: postParam, tab } = await searchParams;
  const gate = canUseEducatorCommunity(user);
  const followingTab = tab === "following";

  const focusId = isCuid(postParam) ? postParam : null;
  const cursorId = isCuid(cursor) ? cursor : null;

  const followingIds = followingTab
    ? (
        await prisma.follow.findMany({
          where: { followerId: user.id },
          select: { followingId: true },
        })
      ).map((row) => row.followingId)
    : [];

  const followingWhere: Prisma.FeedPostWhereInput | undefined =
    followingTab
      ? { authorId: { in: followingIds.length ? followingIds : ["__none__"] } }
      : undefined;

  const [focused, cursorRow] = await Promise.all([
    focusId
      ? prisma.feedPost.findUnique({
          where: { id: focusId },
          include: feedInclude(FEED_COMMENT_FOCUS),
        })
      : Promise.resolve(null),
    cursorId
      ? prisma.feedPost.findUnique({
          where: { id: cursorId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const rows =
    followingTab && followingIds.length === 0 && !focused
      ? []
      : await prisma.feedPost.findMany({
          take: FEED_PAGE_SIZE + 1,
          ...(cursorRow ? { skip: 1, cursor: { id: cursorRow.id } } : {}),
          where: {
            ...(focused ? { id: { not: focused.id } } : {}),
            ...followingWhere,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: feedInclude(FEED_COMMENT_PREVIEW),
        });

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;
  const empty = !focused && page.length === 0;

  const postIds = [focused, ...page].filter(Boolean).map((item) => item!.id);
  const reactionRows =
    postIds.length === 0
      ? []
      : await prisma.reaction.findMany({
          where: { targetType: TARGET_FEED_POST, targetId: { in: postIds } },
          select: { targetId: true, emoji: true, userId: true },
        });
  const reactions = tallyReactionsByTarget(reactionRows, user.id);

  const olderHref = nextCursor
    ? followingTab
      ? `/community?tab=following&cursor=${encodeURIComponent(nextCursor)}`
      : `/community?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Teacher Social
      </h1>
      <p className="mt-3 text-muted-foreground">
        {user.role === Role.STUDENT
          ? "Teacher Social is for educators. Students post in Student Circle groups and the forum. There is no private inbox or DMs."
          : "Join groups of your choice, share thoughts, and interact with other educators. Posts here are member-visible. There is no private inbox or DMs."}
      </p>
      <CommunityNav current="/community" />

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/community"
          className={cn(
            "rounded-md px-3 py-1.5 font-medium",
            !followingTab
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Community
        </Link>
        <Link
          href="/community?tab=following"
          className={cn(
            "rounded-md px-3 py-1.5 font-medium",
            followingTab
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Following
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {user.role === Role.STUDENT || user.role === Role.PARENT ? (
          <>
            Looking for a student space?{" "}
            <Link href="/groups" className="font-medium text-primary hover:underline">
              Open Student Circle groups
            </Link>
            .
          </>
        ) : (
          <>
            Looking for a group?{" "}
            <Link href="/groups" className="font-medium text-primary hover:underline">
              Browse Job Alerts, Social Network, and more
            </Link>
            .
          </>
        )}
      </p>

      <div className="mt-8">
        {gate.ok ? (
          <FeedComposer />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            {gate.reason}{" "}
            {user.role === Role.STUDENT
              ? "You can still read educator posts here."
              : "You can still read the feed."}
          </p>
        )}
      </div>

      {focused ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Showing a linked post.{" "}
          <Link href="/community" className="font-medium text-primary hover:underline">
            Back to the full feed
          </Link>
        </p>
      ) : null}

      {empty ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          {followingTab
            ? "No posts from people you follow yet. Follow educators from the directory, then return here."
            : "No posts yet. Be the first educator to share something."}
        </p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {focused ? (
            <li>
              <FeedPostCard
                post={focused}
                comments={focused.comments}
                commentCount={focused._count.comments}
                canComment={gate.ok}
                canReact={gate.ok}
                reactionCounts={reactions.get(focused.id)?.counts ?? {}}
                myReactions={reactions.get(focused.id)?.mine ?? []}
                highlighted
                focused
              />
            </li>
          ) : null}
          {page.map((item) => (
            <li key={item.id}>
              <FeedPostCard
                post={item}
                comments={item.comments}
                commentCount={item._count.comments}
                canComment={gate.ok}
                canReact={gate.ok}
                reactionCounts={reactions.get(item.id)?.counts ?? {}}
                myReactions={reactions.get(item.id)?.mine ?? []}
              />
            </li>
          ))}
        </ul>
      )}

      {olderHref ? (
        <p className="mt-10">
          <Link href={olderHref} className="font-medium text-primary hover:underline">
            Older posts
          </Link>
        </p>
      ) : null}
    </section>
  );
}
