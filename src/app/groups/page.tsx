import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommunityNav } from "@/components/community/community-nav";
import { JoinGroupButton } from "@/components/groups/join-group-button";
import { canUseEducatorCommunity } from "@/lib/community";
import { DemoGroupsIndex } from "@/components/demo/demo-groups";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Groups",
  description:
    "Educator groups on EduVoq — Job Alerts and Social Network.",
  robots: { index: false, follow: false },
};

export default async function GroupsPage() {
  if (await isDemoMode()) return <DemoGroupsIndex />;
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/groups");

  const gate = canUseEducatorCommunity(user);
  const groups = await prisma.group.findMany({
    orderBy: [{ isOfficial: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { memberships: true, posts: true } },
      memberships: {
        where: { userId: user.id },
        select: { userId: true },
        take: 1,
      },
    },
  });

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Groups
      </h1>
      <p className="mt-3 text-muted-foreground">
        Join groups of your choice, share thoughts, and interact with others.
        Official groups are seeded for Job Alerts and Social Network.
      </p>
      <CommunityNav current="/groups" />

      {groups.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No groups yet. Seed the database to create Job Alerts and Social
          Network.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {groups.map((group) => {
            const isMember = group.memberships.length > 0;
            return (
              <li
                key={group.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">
                      {group.isOfficial ? "Official group" : "Group"}
                    </p>
                    <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
                      <Link
                        href={`/groups/${group.slug}`}
                        className="hover:underline"
                      >
                        {group.name}
                      </Link>
                    </h2>
                    {group.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-muted-foreground">
                      {group._count.memberships} member
                      {group._count.memberships === 1 ? "" : "s"} ·{" "}
                      {group._count.posts} post
                      {group._count.posts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <JoinGroupButton
                    slug={group.slug}
                    isMember={isMember}
                    canJoin={gate.ok}
                    blockedReason={gate.ok ? undefined : gate.reason}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
