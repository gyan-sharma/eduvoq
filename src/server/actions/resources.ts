"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import {
  FileAcl,
  FileOwnerType,
  ResourceStatus,
  ResourceVisibility,
  Role,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { newId } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { validateUpload } from "@/lib/storage/limits";
import { resourceObjectKey } from "@/lib/storage/object-key";
import {
  updateResourceMetaSchema,
  uploadResourceSchema,
} from "@/lib/validators/resource";
import { authorizeFileAccess, canUploadResource } from "@/lib/entitlements";
import { prisma } from "@/server/db";
import { requireRole, requireSession } from "@/server/rbac";
import { uniqueResourceSlug } from "@/server/resources";

export type ResourceActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function emptyToUndef(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function revalidateResourcePaths(): void {
  revalidatePath("/resources");
  revalidatePath("/resources/learning-material");
  revalidatePath("/resources/class-notes");
  revalidatePath("/resources/sample-papers");
  revalidatePath("/sample-papers");
}

export async function uploadResource(
  _prev: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  let user;
  try {
    user = await requireRole(
      Role.EDUCATOR,
      Role.EXPERT,
      Role.STAFF,
      Role.ADMIN,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login");
    }
    return {
      error:
        "You need an active educator, expert, staff, or admin account to upload.",
    };
  }

  if (!canUploadResource(user)) {
    return { error: "You are not entitled to upload to Resource Corner." };
  }

  const parsed = uploadResourceSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    board: emptyToUndef(String(formData.get("board") ?? "")),
    classLevel: emptyToUndef(String(formData.get("classLevel") ?? "")),
    subject: emptyToUndef(String(formData.get("subject") ?? "")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const uploaded = formData.get("file");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const body = Buffer.from(await uploaded.arrayBuffer());
  const checked = validateUpload(body, uploaded.name);
  if (!checked.ok) return { error: checked.error };

  const resourceId = newId();
  const fileId = newId();
  const objectKey = resourceObjectKey(resourceId, checked.filename);
  const checksumSha256 = createHash("sha256").update(body).digest("hex");
  const storage = getStorage();

  const staffPublish = user.role === Role.STAFF || user.role === Role.ADMIN;
  const status = staffPublish
    ? ResourceStatus.PUBLISHED
    : ResourceStatus.IN_REVIEW;

  let stored = false;
  try {
    const put = await storage.put({
      objectKey,
      body,
      mimeType: checked.mime,
    });
    stored = true;

    const slug = await uniqueResourceSlug(parsed.data.title);

    await prisma.$transaction(async (tx) => {
      await tx.fileObject.create({
        data: {
          id: fileId,
          bucket: put.bucket,
          objectKey,
          mimeType: checked.mime,
          byteSize: put.byteSize,
          checksumSha256,
          acl: FileAcl.PRIVATE,
          ownerType: FileOwnerType.RESOURCE,
          ownerId: resourceId,
          uploadedById: user.id,
        },
      });
      await tx.resource.create({
        data: {
          id: resourceId,
          slug,
          title: parsed.data.title,
          kind: parsed.data.kind,
          status,
          visibility: ResourceVisibility.EDUCATOR_ONLY,
          board: parsed.data.board,
          classLevel: parsed.data.classLevel,
          subject: parsed.data.subject,
          fileId,
          uploadedById: user.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: "resource.upload",
          entity: "Resource",
          entityId: resourceId,
          meta: {
            kind: parsed.data.kind,
            status,
            mimeType: checked.mime,
            byteSize: put.byteSize,
          },
        },
      });
    });
  } catch (error) {
    if (stored) {
      await storage.delete(objectKey).catch(() => undefined);
    }
    logger.error({ err: error, userId: user.id }, "resource upload failed");
    return { error: "Upload failed. Try again." };
  }

  revalidateResourcePaths();
  logger.info(
    { resourceId, fileId, userId: user.id, status },
    "resource uploaded",
  );

  return {
    ok: true,
    message: staffPublish
      ? "Published to Resource Corner."
      : "Uploaded. It will appear after staff review.",
  };
}

export async function updateResourceMeta(
  _prev: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  let user;
  try {
    user = await requireSession();
  } catch {
    redirect("/login");
  }

  const parsed = updateResourceMetaSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? ""),
    board: emptyToUndef(String(formData.get("board") ?? "")),
    classLevel: emptyToUndef(String(formData.get("classLevel") ?? "")),
    subject: emptyToUndef(String(formData.get("subject") ?? "")),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const resource = await prisma.resource.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, uploadedById: true, status: true },
  });
  if (!resource) return { error: "Resource not found." };

  const staff = user.role === Role.STAFF || user.role === Role.ADMIN;
  if (!staff && resource.uploadedById !== user.id) {
    return { error: "You can only edit your own uploads." };
  }
  if (!staff && resource.status !== ResourceStatus.IN_REVIEW) {
    return { error: "Published resources can only be edited by staff." };
  }

  await prisma.resource.update({
    where: { id: resource.id },
    data: {
      title: parsed.data.title,
      board: parsed.data.board ?? null,
      classLevel: parsed.data.classLevel ?? null,
      subject: parsed.data.subject ?? null,
    },
  });
  revalidateResourcePaths();
  return { ok: true, message: "Details updated." };
}

/** Entitlement check then the ACL stream URL. GET /api/files/[id] records the download. */
export async function requestDownload(
  fileId: string,
): Promise<{ error?: string; url?: string }> {
  let user;
  try {
    user = await requireSession();
  } catch {
    return { error: "Sign in to download this file." };
  }

  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    include: { resourceAsFile: true },
  });
  if (!file) return { error: "File not found." };

  const decision = authorizeFileAccess({
    file,
    resource: file.resourceAsFile,
    user,
  });
  if (decision !== "allow") {
    return { error: "You do not have access to this file." };
  }

  return { url: `/api/files/${file.id}` };
}
