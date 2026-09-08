"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  canUseEducatorCommunity,
  isValidOptionIdx,
  parsePollJson,
} from "@/lib/community";
import { plainTextToDoc } from "@/lib/tiptap-text";
import {
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

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function revalidateGroup(slug: string) {
  revalidatePath("/groups");
  revalidatePath(`/groups/${slug}`);
}

async function loadGroup(slug: string) {
  return prisma.group.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
}

async function requireMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { userId: true },
  });
}

export async function joinGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = groupSlugSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

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

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = groupPostSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

  const member = await requireMembership(group.id, user.id);
  if (!member) return { error: "Join this group to post." };

  await prisma.groupPost.create({
    data: {
      groupId: group.id,
      authorId: user.id,
      bodyJson: plainTextToDoc(parsed.data.body) as Prisma.InputJsonValue,
    },
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

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = createPollSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    question: String(formData.get("question") ?? ""),
    options: String(formData.get("options") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const group = await loadGroup(parsed.data.slug);
  if (!group) return { error: "That group does not exist." };

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

  revalidateGroup(group.slug);
  return { ok: true, message: "Poll posted." };
}

export async function votePoll(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

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
      group: { select: { id: true, slug: true } },
    },
  });
  if (!post) return { error: "That poll is no longer available." };

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
