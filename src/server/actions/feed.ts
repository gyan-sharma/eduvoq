"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationType, Prisma } from "@prisma/client";
import {
  TARGET_FEED_POST,
  canUseEducatorCommunity,
  displayName,
  feedPostHref,
} from "@/lib/community";
import { plainTextToDoc } from "@/lib/tiptap-text";
import {
  feedCommentSchema,
  feedPostSchema,
  feedReactSchema,
} from "@/lib/validators/community";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export type CommunityActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createFeedPost(
  _prev: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = feedPostSchema.safeParse({
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  await prisma.feedPost.create({
    data: {
      authorId: user.id,
      bodyJson: plainTextToDoc(parsed.data.body) as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/community");
  return { ok: true, message: "Posted." };
}

export async function createComment(
  _prev: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = feedCommentSchema.safeParse({
    feedPostId: String(formData.get("feedPostId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const post = await prisma.feedPost.findUnique({
    where: { id: parsed.data.feedPostId },
    select: { id: true, authorId: true },
  });
  if (!post) return { error: "That post is no longer available." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.comment.create({
        data: {
          feedPostId: post.id,
          authorId: user.id,
          body: parsed.data.body,
          status: "VISIBLE",
        },
      });
      if (post.authorId !== user.id) {
        await tx.notification.create({
          data: {
            userId: post.authorId,
            type: NotificationType.COMMENT,
            title: `${displayName(user)} commented on your post`,
            body: parsed.data.body.slice(0, 180),
            href: feedPostHref(post.id),
          },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      return { error: "That post is no longer available." };
    }
    throw error;
  }

  if (post.authorId !== user.id) {
    revalidatePath("/account/notifications");
  }
  revalidatePath("/community");
  revalidatePath(feedPostHref(post.id));
  return { ok: true, message: "Comment added." };
}

export async function reactToFeedPost(
  _prev: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const allowed = canUseEducatorCommunity(user);
  if (!allowed.ok) return { error: allowed.reason };

  const parsed = feedReactSchema.safeParse({
    postId: String(formData.get("postId") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const post = await prisma.feedPost.findUnique({
    where: { id: parsed.data.postId },
    select: { id: true },
  });
  if (!post) return { error: "That post is no longer available." };

  const existing = await prisma.reaction.findUnique({
    where: {
      userId_targetType_targetId_emoji: {
        userId: user.id,
        targetType: TARGET_FEED_POST,
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
          targetType: TARGET_FEED_POST,
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

  revalidatePath("/community");
  revalidatePath(feedPostHref(post.id));
  return { ok: true };
}
