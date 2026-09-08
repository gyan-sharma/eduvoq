"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { getSessionUser, requireActiveMember, requireRole } from "@/server/rbac";
import {
  canSetOwnProfilePublic,
  isUsernameChangeLocked,
  replaceFirstName,
} from "@/lib/profile-privacy";
import {
  childPrivacySchema,
  parseStringList,
  studentProfileSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from "@/lib/validators/profile";

export type ProfileActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function formFlag(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function revalidateMember(username: string | null | undefined) {
  revalidatePath("/account");
  revalidatePath("/account/settings");
  revalidatePath("/members");
  if (username) revalidatePath(`/members/${username}`);
}

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") {
    return { error: "Finish activating your account before editing your profile." };
  }

  if (user.role === Role.STUDENT) {
    const parsed = studentProfileSchema.safeParse({
      firstName: String(formData.get("firstName") ?? ""),
      grade: String(formData.get("grade") ?? ""),
      username: String(formData.get("username") ?? ""),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    if (
      parsed.data.username !== user.username &&
      isUsernameChangeLocked(user)
    ) {
      return { error: "Username can only be changed within 14 days of joining." };
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: replaceFirstName(user.name, parsed.data.firstName),
          username: parsed.data.username,
          usernameChangedAt: user.usernameChangedAt ?? user.createdAt,
          classesTaught: parsed.data.grade ? [parsed.data.grade] : [],
          schoolName: null,
          linkedinUrl: null,
          city: null,
          state: null,
          boardAffiliation: null,
          headline: null,
          image: null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { error: "That username is taken." };
      }
      throw error;
    }

    revalidateMember(parsed.data.username);
    if (user.username && user.username !== parsed.data.username) {
      revalidatePath(`/members/${user.username}`);
    }
    return { ok: true, message: "Profile saved." };
  }

  const parsed = updateProfileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    schoolName: String(formData.get("schoolName") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    boardAffiliation: String(formData.get("boardAffiliation") ?? ""),
    subjects: String(formData.get("subjects") ?? ""),
    classesTaught: String(formData.get("classesTaught") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (
    parsed.data.username !== user.username &&
    isUsernameChangeLocked(user)
  ) {
    return { error: "Username can only be changed within 14 days of joining." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        usernameChangedAt: user.usernameChangedAt ?? user.createdAt,
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        schoolName: parsed.data.schoolName,
        city: parsed.data.city,
        state: parsed.data.state,
        boardAffiliation: parsed.data.boardAffiliation,
        subjects: parseStringList(parsed.data.subjects ?? ""),
        classesTaught: parseStringList(parsed.data.classesTaught ?? ""),
        linkedinUrl: parsed.data.linkedinUrl,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "That username is taken." };
    }
    throw error;
  }

  revalidateMember(parsed.data.username);
  if (user.username && user.username !== parsed.data.username) {
    revalidatePath(`/members/${user.username}`);
  }
  return { ok: true, message: "Profile saved." };
}

export async function updateSettings(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "ACTIVE") {
    return { error: "Finish activating your account first." };
  }
  if (!canSetOwnProfilePublic(user.role)) {
    return {
      error:
        "A parent must opt in to a first-name and grade card. Students cannot publish their own profile.",
    };
  }

  const parsed = updateSettingsSchema.safeParse({
    isProfilePublic: formFlag(formData.get("isProfilePublic")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  await prisma.user.update({
    where: { id: user.id },
    data: { isProfilePublic: parsed.data.isProfilePublic },
  });

  revalidateMember(user.username);
  return { ok: true, message: "Privacy settings saved." };
}

export async function updateChildPrivacy(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parent = await requireRole(Role.PARENT).catch(() => null);
  if (!parent) {
    return { error: "Only a parent account can update a student card." };
  }

  const parsed = childPrivacySchema.safeParse({
    childId: String(formData.get("childId") ?? ""),
    isProfilePublic: formFlag(formData.get("isProfilePublic")),
    grade: String(formData.get("grade") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const child = await prisma.user.findFirst({
    where: {
      id: parsed.data.childId,
      parentId: parent.id,
      role: Role.STUDENT,
    },
    select: { id: true, username: true },
  });
  if (!child) return { error: "Student account not found." };

  await prisma.user.update({
    where: { id: child.id },
    data: {
      isProfilePublic: parsed.data.isProfilePublic,
      classesTaught: parsed.data.grade ? [parsed.data.grade] : [],
    },
  });

  revalidateMember(child.username);
  return { ok: true, message: "Student privacy updated." };
}

export async function requestAccountDeletion(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  void formData;
  const user = await requireActiveMember().catch(() => null);
  if (!user) redirect("/login");

  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      action: "account.delete_requested",
      entity: "User",
      entityId: user.id,
      meta: { email: user.email },
    },
  });

  return {
    ok: true,
    message:
      "Deletion requested. An admin will remove personal data; tax invoices may be retained as required by Indian law. You can also email hello@eduvoq.com.",
  };
}
