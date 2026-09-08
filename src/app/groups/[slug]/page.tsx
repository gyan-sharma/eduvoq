import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthorChip } from "@/components/community/author-chip";
import { BodyText } from "@/components/community/body-text";
import { CommunityNav } from "@/components/community/community-nav";
import { GroupPostForm } from "@/components/groups/group-post-form";
import { JoinGroupButton } from "@/components/groups/join-group-button";
import { PollForm } from "@/components/groups/poll-form";
import { PollVoteForm } from "@/components/groups/poll-vote-form";
import {
  canUseEducatorCommunity,
  formatCommunityWhen,
  parsePollJson,
  shouldRenderGroupPostBody,
  tallyVotes,
} from "@/lib/community";
import { DemoGroupDetail } from "@/components/demo/demo-groups";
import { getDemoGroup } from "@/lib/demo-content";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

async function loadGroup(slug: string) {
  return prisma.group.findUnique({
    where: { slug },
    include: {
      _count: { select: { memberships: true, posts: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const group = await loadGroup(slug);
  if (!group) return { title: "Group" };
  return {
    title: group.name,
    description: group.description ?? `${group.name} on EduVoq`,
    robots: { index: false, follow: false },
  };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (await isDemoMode()) {
    const demo = getDemoGroup(slug);
    if (demo) return <DemoGroupDetail group={demo} />;
  }

  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=/groups/${encodeURIComponent(slug)}`);

  const group = await loadGroup(slug);
  if (!group) notFound();

  const gate = canUseEducatorCommunity(user);
  const [membership, posts] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      select: { role: true },
    }),
    prisma.groupPost.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, username: true, image: true },
        },
        votes: { select: { userId: true, optionIdx: true } },
      },
    }),
  ]);

  const isMember = Boolean(membership);
  const canPost = gate.ok && isMember;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/groups" className="text-primary hover:underline">
          ← Groups
        </Link>
      </p>
      <CommunityNav current={`/groups/${group.slug}`} />

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {group.isOfficial ? "Official group" : "Group"}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {group.name}
          </h1>
          {group.description ? (
            <p className="mt-3 text-muted-foreground">{group.description}</p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            {group._count.memberships} member
            {group._count.memberships === 1 ? "" : "s"} · {group._count.posts}{" "}
            post{group._count.posts === 1 ? "" : "s"}
          </p>
        </div>
        <JoinGroupButton
          slug={group.slug}
          isMember={isMember}
          canJoin={gate.ok}
          blockedReason={gate.ok ? undefined : gate.reason}
        />
      </header>

      {canPost ? (
        <div className="mt-8 grid gap-4">
          <GroupPostForm slug={group.slug} />
          <PollForm slug={group.slug} />
        </div>
      ) : gate.ok ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          Join this group to post, create a poll, or vote.
        </p>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          {gate.reason}
        </p>
      )}

      {posts.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No discussions yet.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {posts.map((post) => {
            const poll = parsePollJson(post.pollJson);
            const counts = poll
              ? tallyVotes(poll.options.length, post.votes)
              : [];
            const myVote = post.votes.find((vote) => vote.userId === user.id);
            return (
              <li
                key={post.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <AuthorChip
                    name={post.author.name}
                    username={post.author.username}
                    image={post.author.image}
                  />
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={post.createdAt.toISOString()}
                  >
                    {formatCommunityWhen(post.createdAt)}
                  </time>
                </div>
                {shouldRenderGroupPostBody(post.bodyJson, poll) ? (
                  <div className="mt-4">
                    <BodyText value={post.bodyJson} />
                  </div>
                ) : null}
                {poll ? (
                  <PollVoteForm
                    groupPostId={post.id}
                    question={poll.question}
                    options={poll.options}
                    counts={counts}
                    myOptionIdx={myVote?.optionIdx ?? null}
                    canVote={canPost}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
