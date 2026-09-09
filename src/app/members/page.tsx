import type { Metadata } from "next";
import Link from "next/link";
import { CommunityNav } from "@/components/community/community-nav";
import { DemoMembersIndex } from "@/components/demo/demo-members";
import { MemberCard } from "@/components/members/member-card";
import {
  directoryWhere,
  studentDirectoryWhere,
  toPublicMemberCard,
} from "@/lib/profile-privacy";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/demo";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members",
  description:
    "Community Members - EduVoq. Educators in the public directory, plus opted-in student first-name cards.",
};

const PAGE_SIZE = 24;

const memberSelect = {
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

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; students?: string }>;
}) {
  if (await isDemoMode()) return <DemoMembersIndex />;
  const viewer = await getSessionUser();
  const { cursor, students: studentsCursor } = await searchParams;

  const [educatorRows, studentRows] = await Promise.all([
    prisma.user.findMany({
      where: directoryWhere(),
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: memberSelect,
    }),
    prisma.user.findMany({
      where: studentDirectoryWhere(),
      take: PAGE_SIZE + 1,
      ...(studentsCursor ? { skip: 1, cursor: { id: studentsCursor } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: memberSelect,
    }),
  ]);

  const educatorHasMore = educatorRows.length > PAGE_SIZE;
  const educatorPage = educatorHasMore
    ? educatorRows.slice(0, PAGE_SIZE)
    : educatorRows;
  const nextEducator = educatorHasMore
    ? educatorPage[educatorPage.length - 1]?.id
    : null;
  const educators = educatorPage
    .map((row) => toPublicMemberCard(row, viewer))
    .filter((card) => card !== null);

  const studentHasMore = studentRows.length > PAGE_SIZE;
  const studentPage = studentHasMore
    ? studentRows.slice(0, PAGE_SIZE)
    : studentRows;
  const nextStudent = studentHasMore
    ? studentPage[studentPage.length - 1]?.id
    : null;
  const students = studentPage
    .map((row) => toPublicMemberCard(row, viewer))
    .filter((card) => card !== null);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Members
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Educators, experts, staff, and admins with a public profile appear
        below. Students appear only when a parent opts them into a first-name
        and grade card — never with last name, school, or photo.
      </p>
      <CommunityNav current="/members" />

      <h2 className="mt-10 font-heading text-2xl font-semibold tracking-tight">
        Educators
      </h2>
      {educators.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No public educator profiles yet.{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>{" "}
          to appear here once your profile is active.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {educators.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
      {nextEducator ? (
        <p className="mt-6">
          <Link
            href={`/members?cursor=${encodeURIComponent(nextEducator)}${
              studentsCursor
                ? `&students=${encodeURIComponent(studentsCursor)}`
                : ""
            }`}
            className="font-medium text-primary hover:underline"
          >
            More educators
          </Link>
        </p>
      ) : null}

      <h2 className="mt-14 font-heading text-2xl font-semibold tracking-tight">
        Student Circle
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Opted-in student cards only. Students still cannot post on Teacher
        Social or follow arbitrary adults.
      </p>
      {students.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No opted-in student cards yet. Parents can enable this from their
          account.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((member) => (
            <li key={member.id}>
              <MemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
      {nextStudent ? (
        <p className="mt-6">
          <Link
            href={`/members?students=${encodeURIComponent(nextStudent)}${
              cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
            }`}
            className="font-medium text-primary hover:underline"
          >
            More students
          </Link>
        </p>
      ) : null}
    </section>
  );
}
