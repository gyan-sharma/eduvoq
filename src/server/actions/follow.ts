"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";
import {
  canFollowUser,
  firstName,
  followNotificationHref,
} from "@/lib/profile-privacy";
import { followUsernameSchema } from "@/lib/validators/profile";

export type FollowActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

async function loadTarget(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      parentId: true,
      isProfilePublic: true,
    },
  });
}

function revalidateFollow(actorUsername: string | null, targetUsername: string) {
  revalidatePath(`/members/${targetUsername}`);
  revalidatePath("/members");
  revalidatePath("/account");
  revalidatePath("/account/network");
  revalidatePath("/account/notifications");
  revalidatePath("/community");
  if (actorUsername) revalidatePath(`/members/${actorUsername}`);
}

export async function followUser(
  _prev: FollowActionState,
  formData: FormData,
): Promise<FollowActionState> {
  const actor = await getSessionUser();
  if (!actor) redirect("/login");

  const parsed = followUsernameSchema.safeParse({
    username: String(formData.get("username") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const target = await loadTarget(parsed.data.username);
  if (!target) return { error: "That member is not available." };

  const allowed = canFollowUser(actor, target);
  if (!allowed.ok) return { error: allowed.reason };

  const actorLabel =
    actor.role === Role.STUDENT
      ? firstName(actor.name)
      : actor.name?.trim() || actor.username || "Someone";

  try {
    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId: actor.id, followingId: target.id },
      }),
      prisma.notification.create({
        data: {
          userId: target.id,
          type: NotificationType.FOLLOW,
          title: `${actorLabel} followed you`,
          href: followNotificationHref(actor, target),
        },
      }),
    ]);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, message: "Already following." };
    }
    throw error;
  }

  revalidateFollow(actor.username, parsed.data.username);
  return { ok: true, message: "Following." };
}

export async function unfollowUser(
  _prev: FollowActionState,
  formData: FormData,
): Promise<FollowActionState> {
  const actor = await getSessionUser();
  if (!actor) redirect("/login");

  const parsed = followUsernameSchema.safeParse({
    username: String(formData.get("username") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const target = await loadTarget(parsed.data.username);
  if (!target) return { error: "That member is not available." };
  if (actor.id === target.id) {
    return { error: "You cannot follow yourself." };
  }

  await prisma.follow.deleteMany({
    where: { followerId: actor.id, followingId: target.id },
  });

  revalidateFollow(actor.username, parsed.data.username);
  return { ok: true, message: "Unfollowed." };
}
