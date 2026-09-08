"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  NotificationType,
  Prisma,
  UserStatus,
  type User,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";
import {
  FORUM_WRITES_PER_HOUR,
  TARGET_FORUM_POST,
} from "@/lib/forum";
import { firstName } from "@/lib/profile-privacy";
import { allowForumWrite } from "@/lib/rate-limit";
import { toDoc } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";
import {
  createThreadSchema,
  reactSchema,
  replyThreadSchema,
  reportContentSchema,
} from "@/lib/validators/forum";

export type ForumActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function actorLabel(user: User): string {
  if (user.role === "STUDENT") return firstName(user.name);
  return user.name?.trim() || user.username || "A member";
}

async function requireForumPoster(): Promise<{ user: User } | { error: string }> {
  let user: User;
  try {
    user = await requireSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    return { error: "You cannot post right now." };
  }
  if (user.status !== UserStatus.ACTIVE) {
    return { error: "Finish activating your account before posting in the forum." };
  }
  return { user };
}

function revalidateThread(categorySlug: string, threadSlug: string) {
  revalidatePath("/forum");
  revalidatePath(`/forum/${categorySlug}`);
  revalidatePath(`/forum/${categorySlug}/${threadSlug}`);
}

async function uniqueThreadSlug(categoryId: string, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 8; i += 1) {
    const slug = i === 0 ? base : `${base.slice(0, 64)}-${randomBytes(2).toString("hex")}`;
    const taken = await prisma.forumThread.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  return `${base.slice(0, 48)}-${randomBytes(4).toString("hex")}`;
}

export async function createThread(
  _prev: ForumActionState,
  formData: FormData,
): Promise<ForumActionState> {
  const gate = await requireForumPoster();
  if ("error" in gate) return gate;
  const { user } = gate;

  const parsed = createThreadSchema.safeParse({
    categorySlug: String(formData.get("categorySlug") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (!allowForumWrite(user.id, FORUM_WRITES_PER_HOUR)) {
    return { error: "Too many posts. Try again in a little while." };
  }

  const category = await prisma.forumCategory.findUnique({
    where: { slug: parsed.data.categorySlug },
    select: { id: true, slug: true },
  });
  if (!category) return { error: "That category is not available." };

  const slug = await uniqueThreadSlug(category.id, parsed.data.title);
  const bodyJson = toDoc(parsed.data.body);

  try {
    await prisma.$transaction(async (tx) => {
      const thread = await tx.forumThread.create({
        data: {
          categoryId: category.id,
          authorId: user.id,
          title: parsed.data.title,
          slug,
        },
      });
      await tx.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: user.id,
          bodyJson,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "A thread with that title already exists. Try another title." };
    }
    throw error;
  }

  revalidateThread(category.slug, slug);
  redirect(`/forum/${category.slug}/${slug}`);
}

export async function replyThread(
  _prev: ForumActionState,
  formData: FormData,
): Promise<ForumActionState> {
  const gate = await requireForumPoster();
  if ("error" in gate) return gate;
  const { user } = gate;

  const parsed = replyThreadSchema.safeParse({
    categorySlug: String(formData.get("categorySlug") ?? ""),
    threadSlug: String(formData.get("threadSlug") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (!allowForumWrite(user.id, FORUM_WRITES_PER_HOUR)) {
    return { error: "Too many posts. Try again in a little while." };
  }

  const category = await prisma.forumCategory.findUnique({
    where: { slug: parsed.data.categorySlug },
    select: { id: true, slug: true },
  });
  if (!category) return { error: "That category is not available." };

  const thread = await prisma.forumThread.findUnique({
    where: {
      categoryId_slug: { categoryId: category.id, slug: parsed.data.threadSlug },
    },
    select: {
      id: true,
      slug: true,
      locked: true,
      authorId: true,
      title: true,
    },
  });
  if (!thread) return { error: "That thread is not available." };
  if (thread.locked) return { error: "This thread is locked." };

  let parentAuthorId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.forumPost.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, threadId: true, authorId: true },
    });
    if (!parent || parent.threadId !== thread.id) {
      return { error: "That reply target is not on this thread." };
    }
    parentAuthorId = parent.authorId;
  }

  const bodyJson = toDoc(parsed.data.body);
  const href = `/forum/${category.slug}/${thread.slug}`;
  const notifyUserId = parentAuthorId ?? thread.authorId;
  const label = actorLabel(user);

  await prisma.$transaction(async (tx) => {
    await tx.forumPost.create({
      data: {
        threadId: thread.id,
        authorId: user.id,
        parentId: parsed.data.parentId,
        bodyJson,
      },
    });
    if (notifyUserId && notifyUserId !== user.id) {
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          type: parentAuthorId
            ? NotificationType.REPLY
            : NotificationType.FORUM,
          title: parentAuthorId
            ? `${label} replied to your post`
            : `${label} replied in “${thread.title}”`,
          href,
        },
      });
    }
  });

  revalidateThread(category.slug, thread.slug);
  revalidatePath("/account/notifications");
  return { ok: true, message: "Reply posted." };
}

export async function react(
  _prev: ForumActionState,
  formData: FormData,
): Promise<ForumActionState> {
  const gate = await requireForumPoster();
  if ("error" in gate) return gate;
  const { user } = gate;

  const parsed = reactSchema.safeParse({
    postId: String(formData.get("postId") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const post = await prisma.forumPost.findUnique({
    where: { id: parsed.data.postId },
    select: {
      id: true,
      thread: {
        select: {
          slug: true,
          category: { select: { slug: true } },
        },
      },
    },
  });
  if (!post) return { error: "That post is not available." };

  const existing = await prisma.reaction.findUnique({
    where: {
      userId_targetType_targetId_emoji: {
        userId: user.id,
        targetType: TARGET_FORUM_POST,
        targetId: post.id,
        emoji: parsed.data.emoji,
      },
    },
    select: { id: true },
  });

  if (existing) {
    try {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        )
      ) {
        throw error;
      }
    }
  } else {
    try {
      await prisma.reaction.create({
        data: {
          userId: user.id,
          targetType: TARGET_FORUM_POST,
          targetId: post.id,
          emoji: parsed.data.emoji,
        },
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
      ) {
        throw error;
      }
    }
  }

  revalidateThread(post.thread.category.slug, post.thread.slug);
  return { ok: true };
}

export async function reportContent(
  _prev: ForumActionState,
  formData: FormData,
): Promise<ForumActionState> {
  const gate = await requireForumPoster();
  if ("error" in gate) return gate;
  const { user } = gate;

  const parsed = reportContentSchema.safeParse({
    targetType: String(formData.get("targetType") ?? ""),
    targetId: String(formData.get("targetId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (parsed.data.targetType === TARGET_FORUM_POST) {
    const post = await prisma.forumPost.findUnique({
      where: { id: parsed.data.targetId },
      select: { id: true, authorId: true },
    });
    if (!post) return { error: "That post is not available." };
    if (post.authorId === user.id) {
      return { error: "You cannot report your own post." };
    }
  } else {
    const thread = await prisma.forumThread.findUnique({
      where: { id: parsed.data.targetId },
      select: { id: true, authorId: true },
    });
    if (!thread) return { error: "That thread is not available." };
    if (thread.authorId === user.id) {
      return { error: "You cannot report your own thread." };
    }
  }

  const already = await prisma.report.findFirst({
    where: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (already) {
    return { ok: true, message: "You already reported this. Staff will review it." };
  }

  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
    },
  });

  return { ok: true, message: "Report submitted. Staff will review it." };
}
