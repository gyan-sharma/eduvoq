import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberCard } from "@/components/members/member-card";
import {
  canViewProfile,
  toPublicMemberCard,
} from "@/lib/profile-privacy";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

const profileSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  status: true,
  parentId: true,
  isProfilePublic: true,
} as const;

const cardSelect = {
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
} as const;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Followers · @${username}`,
    robots: { index: false, follow: false },
  };
}

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getSessionUser();
  const profile = await prisma.user.findUnique({
    where: { username },
    select: profileSelect,
  });
  if (!profile || !canViewProfile(profile, viewer)) notFound();

  const rows = await prisma.follow.findMany({
    where: { followingId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { follower: { select: cardSelect } },
  });

  const members = rows
    .map((row) => toPublicMemberCard(row.follower, viewer))
    .filter((card) => card !== null);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm text-muted-foreground">
        <Link
          href={`/members/${username}`}
          className="text-primary hover:underline"
        >
          ← @{username}
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
        Followers
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hidden or restricted profiles are omitted. There is no private inbox.
      </p>
      {members.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No visible followers yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
