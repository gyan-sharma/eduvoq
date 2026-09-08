import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { CommunityNav } from "@/components/community/community-nav";
import { FeedComposer } from "@/components/community/feed-composer";
import { FeedPostCard } from "@/components/community/feed-post-card";
import {
  canUseEducatorCommunity,
  FEED_COMMENT_FOCUS,
  FEED_COMMENT_PREVIEW,
  FEED_PAGE_SIZE,
  isCuid,
} from "@/lib/community";
import { DemoCommunityPage } from "@/components/demo/demo-community";
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
  searchParams: Promise<{ cursor?: string; post?: string }>;
}) {
  if (await isDemoMode()) return <DemoCommunityPage />;
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/community");

  const { cursor, post: postParam } = await searchParams;
  const gate = canUseEducatorCommunity(user);

  const focusId = isCuid(postParam) ? postParam : null;
  const cursorId = isCuid(cursor) ? cursor : null;

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

  const rows = await prisma.feedPost.findMany({
    take: FEED_PAGE_SIZE + 1,
    ...(cursorRow ? { skip: 1, cursor: { id: cursorRow.id } } : {}),
    ...(focused ? { where: { id: { not: focused.id } } } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: feedInclude(FEED_COMMENT_PREVIEW),
  });

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;
  const empty = !focused && page.length === 0;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Teacher Social
      </h1>
      <p className="mt-3 text-muted-foreground">
        Join groups of your choice, share thoughts, and interact with other
        educators. Posts here are member-visible. There is no private inbox or
        DMs.
      </p>
      <CommunityNav current="/community" />

      <p className="mt-6 text-sm text-muted-foreground">
        Looking for a group?{" "}
        <Link href="/groups" className="font-medium text-primary hover:underline">
          Browse Job Alerts and Social Network
        </Link>
        .
      </p>

      <div className="mt-8">
        {gate.ok ? (
          <FeedComposer />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            {gate.reason} You can still read the feed.
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
          No posts yet. Be the first educator to share something.
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
              />
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <p className="mt-10">
          <Link
            href={`/community?cursor=${encodeURIComponent(nextCursor)}`}
            className="font-medium text-primary hover:underline"
          >
            Older posts
          </Link>
        </p>
      ) : null}
    </section>
  );
}
