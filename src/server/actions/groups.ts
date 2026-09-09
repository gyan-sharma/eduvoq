"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationType, Prisma, Role } from "@prisma/client";
import {
  canCreateGroup,
  canJoinGroupAudience,
  defaultGroupAudience,
  displayName,
  isValidOptionIdx,
  parsePollJson,
} from "@/lib/community";
import { firstName } from "@/lib/profile-privacy";
import { slugify } from "@/lib/slug";
import { plainTextToDoc } from "@/lib/tiptap-text";
import {
  createGroupSchema,
  createPollSchema,
  groupPostSchema,
  groupSlugSchema,
  votePollSchema,
} from "@/lib/validators/community";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export type GroupActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

const GROUP_NOTIFY_CAP = 50;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function actorLabel(user: { role: Role; name: string | null; username: string | null }) {
  return user.role === Role.STUDENT ? firstName(user.name) : displayName(user);
}

function revalidateGroup(slug: string) {
  revalidatePath("/groups");
  revalidatePath(`/groups/${slug}`);
}

async function loadGroup(slug: string) {
  return prisma.group.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, audience: true },
  });
}

async function requireMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { userId: true },
  });
}

async function uniqueGroupSlug(name: string): Promise<string> {
  const base = slugify(name, 48);
  for (let i = 0; i < 12; i += 1) {
    const slug =
      i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const taken = await prisma.group.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

async function notifyGroupMembers(opts: {
  groupId: string;
  groupName: string;
  groupSlug: string;
  authorId: string;
  authorLabel: string;
  preview: string;
}) {
  const members = await prisma.groupMember.findMany({
    where: { groupId: opts.groupId, userId: { not: opts.authorId } },
    take: GROUP_NOTIFY_CAP,
    select: { userId: true },
  });
  if (members.length === 0) return;
  await prisma.notification.createMany({
    data: members.map((member) => ({
      userId: member.userId,
      type: NotificationType.GROUP,
      title: `${opts.authorLabel} posted in ${opts.groupName}`,
      body: opts.preview.slice(0, 180) || null,
      href: `/groups/${opts.groupSlug}`,
    })),
  });
  revalidatePath("/account/notifications");
}

export async function createGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canCreateGroup(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = createGroupSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const slug = await uniqueGroupSlug(parsed.data.name);
  const audience = defaultGroupAudience(user.role);
  const description = parsed.data.description?.trim() || null;

  const group = await prisma.group.create({
    data: {
      slug,
      name: parsed.data.name,
      description,
      isOfficial: false,
      audience,
      createdById: user.id,
      memberships: {
        create: { userId: user.id, role: "ADMIN" },
      },
    },
    select: { slug: true },
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.slug}`);
}

export async function joinGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = groupSlugSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

  const allowed = canJoinGroupAudience(user, group.audience);
  if (!allowed.ok) return { error: allowed.reason };

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id, role: "MEMBER" },
  });

  revalidateGroup(group.slug);
  return { ok: true, message: `Joined ${group.name}.` };
}

export async function leaveGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = groupSlugSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

  await prisma.groupMember.deleteMany({
    where: { groupId: group.id, userId: user.id },
  });

  revalidateGroup(group.slug);
  return { ok: true, message: `Left ${group.name}.` };
}

export async function createGroupPost(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = groupPostSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

  const allowed = canJoinGroupAudience(user, group.audience);
  if (!allowed.ok) return { error: allowed.reason };

  const member = await requireMembership(group.id, user.id);
  if (!member) return { error: "Join this group to post." };

  await prisma.groupPost.create({
    data: {
      groupId: group.id,
      authorId: user.id,
      bodyJson: plainTextToDoc(parsed.data.body) as Prisma.InputJsonValue,
    },
  });

  await notifyGroupMembers({
    groupId: group.id,
    groupName: group.name,
    groupSlug: group.slug,
    authorId: user.id,
    authorLabel: actorLabel(user),
    preview: parsed.data.body,
  });

  revalidateGroup(group.slug);
  return { ok: true, message: "Posted." };
}

export async function createPoll(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = createPollSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    question: String(formData.get("question") ?? ""),
    options: String(formData.get("options") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

  const allowed = canJoinGroupAudience(user, group.audience);
  if (!allowed.ok) return { error: allowed.reason };

  const member = await requireMembership(group.id, user.id);
  if (!member) return { error: "Join this group to post a poll." };

  await prisma.groupPost.create({
    data: {
      groupId: group.id,
      authorId: user.id,
      bodyJson: plainTextToDoc("") as Prisma.InputJsonValue,
      pollJson: {
        question: parsed.data.question,
        options: parsed.data.options,
      },
    },
  });

  await notifyGroupMembers({
    groupId: group.id,
    groupName: group.name,
    groupSlug: group.slug,
    authorId: user.id,
    authorLabel: actorLabel(user),
    preview: parsed.data.question,
  });

  revalidateGroup(group.slug);
  return { ok: true, message: "Poll posted." };
}

export async function votePoll(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = votePollSchema.safeParse({
    groupPostId: String(formData.get("groupPostId") ?? ""),
    optionIdx: String(formData.get("optionIdx") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const post = await prisma.groupPost.findUnique({
    where: { id: parsed.data.groupPostId },
    select: {
      id: true,
      pollJson: true,
      group: { select: { id: true, slug: true, audience: true } },
    },
  });
  if (!post) return { error: "That poll is no longer available." };

  const allowed = canJoinGroupAudience(user, post.group.audience);
  if (!allowed.ok) return { error: allowed.reason };

  const poll = parsePollJson(post.pollJson);
  if (!poll) return { error: "This post is not a poll." };

  const member = await requireMembership(post.group.id, user.id);
  if (!member) return { error: "Join this group to vote." };

  if (!isValidOptionIdx(poll.options.length, parsed.data.optionIdx)) {
    return { error: "Choose a valid option." };
  }

  try {
    await prisma.pollVote.upsert({
      where: {
        groupPostId_userId: {
          groupPostId: post.id,
          userId: user.id,
        },
      },
      create: {
        groupPostId: post.id,
        userId: user.id,
        optionIdx: parsed.data.optionIdx,
      },
      update: { optionIdx: parsed.data.optionIdx },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, message: "Vote recorded." };
    }
    throw error;
  }

  revalidateGroup(post.group.slug);
  return { ok: true, message: "Vote recorded." };
}
