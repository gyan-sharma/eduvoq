import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { FollowButton } from "@/components/members/follow-button";
import {
  BOARD_LABELS,
  canFollowUser,
  canViewProfile,
  ROLE_LABELS,
  toPublicMemberCard,
} from "@/lib/profile-privacy";
import { DemoMemberProfile } from "@/components/demo/demo-members";
import { getDemoMember } from "@/lib/demo-content";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

const profileSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  status: true,
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
  isProfilePublic: true,
  createdAt: true,
} as const;

async function loadProfile(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: profileSelect,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) return { title: "Profile" };
  const viewer = await getSessionUser();
  if (!canViewProfile(user, viewer)) return { title: "Profile" };
  const card = toPublicMemberCard(user, viewer);
  return {
    title: card?.displayName ?? "Profile",
    description: card?.headline ?? `${card?.displayName ?? "Member"} on EduVoq`,
    robots: user.role === Role.STUDENT ? { index: false, follow: false } : undefined,
  };
}

function formatJoined(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (await isDemoMode()) {
    const demo = getDemoMember(username);
    if (demo) return <DemoMemberProfile member={demo} />;
  }
  const user = await loadProfile(username);
  if (!user) notFound();

  const viewer = await getSessionUser();
  if (!canViewProfile(user, viewer)) notFound();

  const card = toPublicMemberCard(user, viewer);
  if (!card) notFound();

  const [followerCount, followingCount, followRow] = await Promise.all([
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewer
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewer.id,
              followingId: user.id,
            },
          },
          select: { followerId: true },
        })
      : Promise.resolve(null),
  ]);

  const isSelf = viewer?.id === user.id;
  const followCheck = viewer ? canFollowUser(viewer, user) : { ok: false as const, reason: "" };
  const isFollowing = Boolean(followRow);
  const place = [card.city, card.state].filter(Boolean).join(", ");
  const board = card.boardAffiliation ? BOARD_LABELS[card.boardAffiliation] : null;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/members" className="text-primary hover:underline">
          ← Educators
        </Link>
      </p>

      {isSelf && !user.isProfilePublic ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Your profile is hidden from the public directory.{" "}
          <Link href="/account/settings" className="font-medium underline">
            Change privacy
          </Link>
        </p>
      ) : null}

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        {card.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt=""
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-20 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground"
          >
            {card.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {ROLE_LABELS[card.role]}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {card.displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">@{card.username}</p>
          {card.headline ? (
            <p className="mt-3 text-foreground">{card.headline}</p>
          ) : null}
          {place || board ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {[place, board].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            {followerCount} follower{followerCount === 1 ? "" : "s"} ·{" "}
            {followingCount} following · Joined {formatJoined(user.createdAt)}
          </p>
        </div>
        <div className="sm:pt-6">
          {isSelf ? (
            <Link
              href="/account/settings"
              className="inline-flex rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              Edit profile
            </Link>
          ) : (
            <FollowButton
              username={card.username}
              isFollowing={isFollowing}
              signedIn={Boolean(viewer)}
              canFollow={followCheck.ok}
              blockedReason={
                followCheck.ok ? undefined : followCheck.reason
              }
            />
          )}
        </div>
      </header>

      {card.restricted ? (
        <p className="mt-8 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          This is a student first-name and grade card. Last name, school, and
          photo are not published.
        </p>
      ) : (
        <div className="mt-8 grid gap-6">
          {card.bio ? (
            <section>
              <h2 className="font-heading text-lg font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {card.bio}
              </p>
            </section>
          ) : null}
          {card.schoolName ? (
            <p className="text-sm text-muted-foreground">
              School: {card.schoolName}
            </p>
          ) : null}
          {card.subjects.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Subjects: {card.subjects.join(", ")}
            </p>
          ) : null}
          {card.classesTaught.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Classes: {card.classesTaught.join(", ")}
            </p>
          ) : null}
          {card.linkedinUrl ? (
            <p className="text-sm">
              <a
                href={card.linkedinUrl}
                className="text-primary hover:underline"
                rel="noreferrer noopener"
                target="_blank"
              >
                LinkedIn
              </a>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
