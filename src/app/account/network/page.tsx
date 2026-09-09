import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberCard } from "@/components/members/member-card";
import { toPublicMemberCard } from "@/lib/profile-privacy";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

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

export default async function AccountNetworkPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [followers, following] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { follower: { select: cardSelect } },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { following: { select: cardSelect } },
    }),
  ]);

  const followerCards = followers
    .map((row) => toPublicMemberCard(row.follower, user))
    .filter((card) => card !== null);
  const followingCards = following
    .map((row) => toPublicMemberCard(row.following, user))
    .filter((card) => card !== null);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Network
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        People you follow and who follow you. There is no private inbox or DMs.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-stone-900">Followers</h2>
      {followerCards.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">No followers yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {followerCards.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-stone-900">Following</h2>
      {followingCards.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">
          You are not following anyone yet.{" "}
          <Link href="/members" className="font-medium text-emerald-800 hover:underline">
            Browse members
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {followingCards.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
