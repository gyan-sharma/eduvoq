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
  GROUP_AUDIENCE_STUDENT,
  canJoinGroupAudience,
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

  const joinGate = canJoinGroupAudience(user, group.audience);
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    select: { role: true },
  });

  const isMember = Boolean(membership);
  const canPost = joinGate.ok && isMember;
  const studentSpace = group.audience === GROUP_AUDIENCE_STUDENT;
  const staffViewer = user.role === "STAFF" || user.role === "ADMIN";
  const canSeePosts = isMember || staffViewer;

  const posts = canSeePosts
    ? await prisma.groupPost.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
              role: true,
            },
          },
          votes: { select: { userId: true, optionIdx: true } },
        },
      })
    : [];

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
            {studentSpace
              ? "Student Circle"
              : group.isOfficial
                ? "Official group"
                : "Educator group"}
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
          canJoin={joinGate.ok}
          blockedReason={joinGate.ok ? undefined : joinGate.reason}
        />
      </header>

      {canPost ? (
        <div className="mt-8 grid gap-4">
          <GroupPostForm slug={group.slug} />
          <PollForm slug={group.slug} />
        </div>
      ) : joinGate.ok ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          Join this group to post, create a poll, or vote.
        </p>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          {joinGate.reason}
        </p>
      )}

      {!canSeePosts ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          This group is limited to its audience. Join if you are allowed, or
          pick a different group.
        </p>
      ) : posts.length === 0 ? (
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
                    restricted={
                      studentSpace && post.author.role === "STUDENT"
                    }
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
