import type { Metadata } from "next";
import Link from "next/link";
import { DemoMembersIndex } from "@/components/demo/demo-members";
import { MemberCard } from "@/components/members/member-card";
import { directoryWhere, toPublicMemberCard } from "@/lib/profile-privacy";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Educators",
  description: "Community Members - EduVoq. A public directory of educators.",
};

const PAGE_SIZE = 24;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  if (await isDemoMode()) return <DemoMembersIndex />;
  const { cursor } = await searchParams;
  const rows = await prisma.user.findMany({
    where: directoryWhere(),
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      headline: true,
      image: true,
      city: true,
      state: true,
      boardAffiliation: true,
      schoolName: true,
      bio: true,
      subjects: true,
      classesTaught: true,
      linkedinUrl: true,
      parentId: true,
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;
  const members = page
    .map((row) => toPublicMemberCard(row, null))
    .filter((card) => card !== null);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Educators
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Community members on EduVoq. The directory lists active educators,
        experts, staff, and admins with a public profile. Student accounts are
        never listed.
      </p>

      {members.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No public educator profiles yet.{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>{" "}
          to appear here once your profile is active.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <p className="mt-10">
          <Link
            href={`/members?cursor=${encodeURIComponent(nextCursor)}`}
            className="font-medium text-primary hover:underline"
          >
            Next page
          </Link>
        </p>
      ) : null}
    </section>
  );
}
