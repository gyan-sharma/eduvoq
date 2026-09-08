"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BookingStatus,
  NotificationType,
  PostStatus,
  Prisma,
  ReportStatus,
  ResourceStatus,
  Role,
  UserStatus,
} from "@prisma/client";

import {
  canArchivePost,
  canBanUser,
  canGrantExpertRole,
  canPublishPost,
  canPublishResource,
  canRejectPost,
  canRevokeExpertRole,
  canSetFeatureFlag,
  cmsPublicPath,
  nextFulfillmentStatus,
  shouldDeleteBookingToFreeSlot,
} from "@/lib/admin-policy";
import { logger } from "@/lib/logger";
import { emptyDoc, parseTipTapDoc, textFromTipTap } from "@/content/tiptap";
import {
  bookingAdminSchema,
  cmsPageSchema,
  featureFlagSchema,
  moderatePostSchema,
  orderFulfillSchema,
  reportDecisionSchema,
  resourcePublishSchema,
  userIdSchema,
} from "@/lib/validators/admin";
import {
  adminActionError,
  requireAdmin,
  requireStaff,
  type AdminActionState,
} from "@/server/admin";

export type { AdminActionState };
import { writeAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { revokeSessions } from "@/server/rbac";

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function formBool(value: FormDataEntryValue | null): boolean {
  const raw = String(value ?? "").toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}

function revalidateAdmin(paths: string[]): void {
  for (const path of paths) revalidatePath(path);
}

function usersRedirect(q: string, result: { ok?: string; error?: string }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (result.ok) params.set("ok", result.ok);
  if (result.error) params.set("error", result.error);
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export async function banUser(formData: FormData): Promise<void> {
  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
  });
  const q = String(formData.get("q") ?? "");
  if (!parsed.success) redirect(usersRedirect(q, { error: firstZodError(parsed.error) }));

  try {
    const actor = await requireStaff();
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true, status: true },
    });
    if (!target) redirect(usersRedirect(q, { error: "User not found." }));
    const blocked = canBanUser(actor, target);
    if (blocked) redirect(usersRedirect(q, { error: blocked }));

    await prisma.user.update({
      where: { id: target.id },
      data: { status: UserStatus.BANNED },
    });
    await revokeSessions(target.id);
    await writeAudit({
      actorId: actor.id,
      action: "user.ban",
      entity: "User",
      entityId: target.id,
    });
    revalidateAdmin(["/admin/users", "/admin"]);
    redirect(usersRedirect(q, { ok: "User banned. Their next action will fail." }));
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(usersRedirect(q, { error: mapped.error }));
    throw error;
  }
}

export async function unbanUser(formData: FormData): Promise<void> {
  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
  });
  const q = String(formData.get("q") ?? "");
  if (!parsed.success) redirect(usersRedirect(q, { error: firstZodError(parsed.error) }));

  try {
    const actor = await requireStaff();
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true, status: true },
    });
    if (!target) redirect(usersRedirect(q, { error: "User not found." }));
    const blocked = canBanUser(actor, target);
    if (blocked) redirect(usersRedirect(q, { error: blocked }));

    await prisma.user.update({
      where: { id: target.id },
      data: { status: UserStatus.ACTIVE },
    });
    await writeAudit({
      actorId: actor.id,
      action: "user.unban",
      entity: "User",
      entityId: target.id,
    });
    revalidateAdmin(["/admin/users", "/admin"]);
    redirect(usersRedirect(q, { ok: "User restored to active." }));
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(usersRedirect(q, { error: mapped.error }));
    throw error;
  }
}

export async function grantExpertRole(formData: FormData): Promise<void> {
  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
  });
  const q = String(formData.get("q") ?? "");
  if (!parsed.success) redirect(usersRedirect(q, { error: firstZodError(parsed.error) }));

  try {
    const actor = await requireAdmin();
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true },
    });
    if (!target) redirect(usersRedirect(q, { error: "User not found." }));
    const blocked = canGrantExpertRole(actor, target);
    if (blocked) redirect(usersRedirect(q, { error: blocked }));

    await prisma.user.update({
      where: { id: target.id },
      data: { role: Role.EXPERT },
    });
    await writeAudit({
      actorId: actor.id,
      action: "user.grant_expert",
      entity: "User",
      entityId: target.id,
    });
    revalidateAdmin(["/admin/users", "/admin"]);
    redirect(usersRedirect(q, { ok: "Expert role granted." }));
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(usersRedirect(q, { error: mapped.error }));
    throw error;
  }
}

export async function revokeExpertRole(formData: FormData): Promise<void> {
  const parsed = userIdSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
  });
  const q = String(formData.get("q") ?? "");
  if (!parsed.success) redirect(usersRedirect(q, { error: firstZodError(parsed.error) }));

  try {
    const actor = await requireAdmin();
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, role: true },
    });
    if (!target) redirect(usersRedirect(q, { error: "User not found." }));
    const blocked = canRevokeExpertRole(actor, target);
    if (blocked) redirect(usersRedirect(q, { error: blocked }));

    await prisma.user.update({
      where: { id: target.id },
      data: { role: Role.EDUCATOR },
    });
    await writeAudit({
      actorId: actor.id,
      action: "user.revoke_expert",
      entity: "User",
      entityId: target.id,
    });
    revalidateAdmin(["/admin/users", "/admin"]);
    redirect(usersRedirect(q, { ok: "Expert role removed. User is an educator again." }));
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(usersRedirect(q, { error: mapped.error }));
    throw error;
  }
}

export async function saveCmsPage(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = cmsPageSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    seoTitle: String(formData.get("seoTitle") ?? "") || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "") || undefined,
    published: formBool(formData.get("published")),
    bodyJson: String(formData.get("bodyJson") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const body = parseTipTapDoc(parsed.data.bodyJson) ?? emptyDoc;
  if (!textFromTipTap(body)) {
    return { error: "Page body cannot be empty." };
  }

  let pageId = parsed.data.id;
  try {
    const actor = await requireStaff();
    const existing = parsed.data.id
      ? await prisma.cmsPage.findUnique({ where: { id: parsed.data.id } })
      : await prisma.cmsPage.findUnique({ where: { slug: parsed.data.slug } });

    const slugTaken = await prisma.cmsPage.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (slugTaken && slugTaken.id !== existing?.id) {
      return { error: "That slug is already in use." };
    }

    const data = {
      slug: parsed.data.slug,
      title: parsed.data.title,
      bodyJson: body as Prisma.InputJsonValue,
      seoTitle: parsed.data.seoTitle ?? null,
      seoDescription: parsed.data.seoDescription ?? null,
      published: parsed.data.published,
    };

    const page = existing
      ? await prisma.cmsPage.update({ where: { id: existing.id }, data })
      : await prisma.cmsPage.create({ data });
    pageId = page.id;

    await writeAudit({
      actorId: actor.id,
      action: existing ? "cms.update" : "cms.create",
      entity: "CmsPage",
      entityId: page.id,
      meta: { slug: page.slug, published: page.published },
    });

    revalidatePath(cmsPublicPath(page.slug));
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${page.id}`);
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) return mapped;
    logger.error({ err: error }, "save cms page failed");
    return { error: "Could not save this page." };
  }

  redirect(`/admin/pages/${pageId}?ok=${encodeURIComponent("Page saved.")}`);
}

export async function moderatePost(formData: FormData): Promise<void> {
  const parsed = moderatePostSchema.safeParse({
    postId: String(formData.get("postId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
  });
  const list = "/admin/posts";
  if (!parsed.success) {
    redirect(`${list}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  const preview = (id: string, result: { ok?: string; error?: string }) => {
    const params = new URLSearchParams();
    if (result.ok) params.set("ok", result.ok);
    if (result.error) params.set("error", result.error);
    const query = params.toString();
    return query ? `/admin/posts/${id}?${query}` : `/admin/posts/${id}`;
  };

  try {
    const actor = await requireStaff();
    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        authorId: true,
        publishedAt: true,
        kind: true,
      },
    });
    if (!post) redirect(`${list}?error=${encodeURIComponent("Post not found.")}`);

    const revalidatePublic = () => {
      revalidatePath("/blog");
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath("/news");
      revalidatePath("/rss.xml");
      revalidatePath("/sitemap.xml");
      revalidatePath("/admin/posts");
      revalidatePath(`/admin/posts/${post.id}`);
    };

    if (parsed.data.decision === "publish") {
      if (!canPublishPost(post.status)) {
        redirect(preview(post.id, { error: "This post cannot be published." }));
      }
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: post.publishedAt ?? new Date(),
        },
      });
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: NotificationType.MODERATION,
          title: "Your post was published",
          body: post.title,
          href: `/blog/${post.slug}`,
        },
      });
      await writeAudit({
        actorId: actor.id,
        action: "post.publish",
        entity: "Post",
        entityId: post.id,
        meta: { slug: post.slug },
      });
      revalidatePublic();
      redirect(preview(post.id, { ok: "Post published." }));
    }

    if (parsed.data.decision === "archive") {
      if (!canArchivePost(post.status)) {
        redirect(preview(post.id, { error: "Only published posts can be archived." }));
      }
      await prisma.post.update({
        where: { id: post.id },
        data: { status: PostStatus.ARCHIVED },
      });
      await writeAudit({
        actorId: actor.id,
        action: "post.archive",
        entity: "Post",
        entityId: post.id,
        meta: { slug: post.slug },
      });
      revalidatePublic();
      redirect(preview(post.id, { ok: "Post archived." }));
    }

    if (!canRejectPost(post.status)) {
      redirect(preview(post.id, { error: "This post cannot be rejected." }));
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { status: PostStatus.REJECTED },
    });
    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: NotificationType.MODERATION,
        title: "Your post was not published",
        body: post.title,
        href: "/blog/submit",
      },
    });
    await writeAudit({
      actorId: actor.id,
      action: "post.reject",
      entity: "Post",
      entityId: post.id,
      meta: { slug: post.slug },
    });
    revalidatePath("/admin/posts");
    revalidatePath(`/admin/posts/${post.id}`);
    redirect(preview(post.id, { ok: "Post rejected." }));
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${list}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}

export async function decideReport(formData: FormData): Promise<void> {
  const parsed = reportDecisionSchema.safeParse({
    reportId: String(formData.get("reportId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
  });
  const back = "/admin/reports";
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  try {
    const actor = await requireStaff();
    const report = await prisma.report.findUnique({
      where: { id: parsed.data.reportId },
    });
    if (!report) redirect(`${back}?error=${encodeURIComponent("Report not found.")}`);
    if (report.status !== ReportStatus.OPEN) {
      redirect(`${back}?error=${encodeURIComponent("This report is already closed.")}`);
    }

    const status =
      parsed.data.decision === "action"
        ? ReportStatus.ACTIONED
        : ReportStatus.DISMISSED;
    await prisma.report.update({
      where: { id: report.id },
      data: { status },
    });
    await writeAudit({
      actorId: actor.id,
      action: `report.${parsed.data.decision}`,
      entity: "Report",
      entityId: report.id,
      meta: { targetType: report.targetType, targetId: report.targetId },
    });
    revalidatePath("/admin/reports");
    redirect(
      `${back}?ok=${encodeURIComponent(
        parsed.data.decision === "action" ? "Report actioned." : "Report dismissed.",
      )}`,
    );
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${back}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}

export async function moderateResource(formData: FormData): Promise<void> {
  const parsed = resourcePublishSchema.safeParse({
    resourceId: String(formData.get("resourceId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
  });
  const back = "/admin/resources";
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  try {
    const actor = await requireStaff();
    const resource = await prisma.resource.findUnique({
      where: { id: parsed.data.resourceId },
      select: { id: true, title: true, status: true, uploadedById: true, slug: true },
    });
    if (!resource) {
      redirect(`${back}?error=${encodeURIComponent("Resource not found.")}`);
    }

    if (parsed.data.decision === "publish") {
      if (!canPublishResource(resource.status)) {
        redirect(`${back}?error=${encodeURIComponent("This resource cannot be published.")}`);
      }
      await prisma.resource.update({
        where: { id: resource.id },
        data: { status: ResourceStatus.PUBLISHED },
      });
      await prisma.notification.create({
        data: {
          userId: resource.uploadedById,
          type: NotificationType.MODERATION,
          title: "Your resource was published",
          body: resource.title,
          href: "/resources",
        },
      });
      await writeAudit({
        actorId: actor.id,
        action: "resource.publish",
        entity: "Resource",
        entityId: resource.id,
      });
    } else {
      if (resource.status !== ResourceStatus.IN_REVIEW) {
        redirect(`${back}?error=${encodeURIComponent("Only in-review resources can be rejected.")}`);
      }
      await prisma.resource.update({
        where: { id: resource.id },
        data: { status: ResourceStatus.REJECTED },
      });
      await writeAudit({
        actorId: actor.id,
        action: "resource.reject",
        entity: "Resource",
        entityId: resource.id,
      });
    }

    revalidatePath("/resources");
    revalidatePath("/resources/learning-material");
    revalidatePath("/resources/class-notes");
    revalidatePath("/resources/sample-papers");
    revalidatePath("/sample-papers");
    revalidatePath("/admin/resources");
    redirect(
      `${back}?ok=${encodeURIComponent(
        parsed.data.decision === "publish"
          ? "Resource published."
          : "Resource rejected.",
      )}`,
    );
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${back}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}

export async function advanceOrder(formData: FormData): Promise<void> {
  const parsed = orderFulfillSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
  });
  const back = "/admin/orders";
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  try {
    const actor = await requireStaff();
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: { id: true, status: true },
    });
    if (!order) redirect(`${back}?error=${encodeURIComponent("Order not found.")}`);
    const next = nextFulfillmentStatus(order.status);
    if (!next) {
      redirect(`${back}?error=${encodeURIComponent("This order cannot be advanced.")}`);
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: next },
    });
    await writeAudit({
      actorId: actor.id,
      action: "order.fulfill",
      entity: "Order",
      entityId: order.id,
      meta: { from: order.status, to: next },
    });
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath("/account/orders");
    redirect(
      `/admin/orders/${order.id}?ok=${encodeURIComponent(`Order marked ${next.toLowerCase()}.`)}`,
    );
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${back}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}

export async function adminUpdateBooking(formData: FormData): Promise<void> {
  const parsed = bookingAdminSchema.safeParse({
    bookingId: String(formData.get("bookingId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
  });
  const back = "/admin/bookings";
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  try {
    const actor = await requireStaff();
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
    });
    if (!booking) redirect(`${back}?error=${encodeURIComponent("Booking not found.")}`);

    if (parsed.data.decision === "cancel") {
      if (!shouldDeleteBookingToFreeSlot(booking.status)) {
        redirect(`${back}?error=${encodeURIComponent("This booking cannot be cancelled.")}`);
      }
      await prisma.booking.delete({ where: { id: booking.id } });
      await writeAudit({
        actorId: actor.id,
        action: "booking.cancel",
        entity: "Booking",
        entityId: booking.id,
        meta: {
          from: booking.status,
          deleted: true,
          expertId: booking.expertId,
          startsAt: booking.startsAt.toISOString(),
        },
      });
      revalidatePath("/admin/bookings");
      revalidatePath("/account/bookings");
      redirect(`${back}?ok=${encodeURIComponent("Booking cancelled. The slot is free.")}`);
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      redirect(
        `${back}?error=${encodeURIComponent(
          parsed.data.decision === "complete"
            ? "Only confirmed sessions can be completed."
            : "Only confirmed sessions can be marked no-show.",
        )}`,
      );
    }
    const next =
      parsed.data.decision === "complete"
        ? BookingStatus.COMPLETED
        : BookingStatus.NO_SHOW;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: next },
    });
    await writeAudit({
      actorId: actor.id,
      action: `booking.${parsed.data.decision}`,
      entity: "Booking",
      entityId: booking.id,
      meta: { from: booking.status, to: next },
    });
    revalidatePath("/admin/bookings");
    revalidatePath("/account/bookings");
    redirect(`${back}?ok=${encodeURIComponent("Booking updated.")}`);
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${back}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}

export async function setFeatureFlag(formData: FormData): Promise<void> {
  const parsed = featureFlagSchema.safeParse({
    key: String(formData.get("key") ?? ""),
    enabled: formBool(formData.get("enabled")),
  });
  const nextRaw = String(formData.get("next") ?? "");
  const back = nextRaw === "/admin" ? "/admin" : "/admin/flags";
  if (!parsed.success) {
    redirect(`${back}?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }

  try {
    const actor = await requireAdmin();
    const blocked = canSetFeatureFlag(actor);
    if (blocked) redirect(`${back}?error=${encodeURIComponent(blocked)}`);

    await prisma.featureFlag.upsert({
      where: { key: parsed.data.key },
      update: { enabled: parsed.data.enabled },
      create: {
        key: parsed.data.key,
        enabled: parsed.data.enabled,
      },
    });
    await writeAudit({
      actorId: actor.id,
      action: "flag.set",
      entity: "FeatureFlag",
      entityId: parsed.data.key,
      meta: { enabled: parsed.data.enabled },
    });
    revalidatePath("/admin/flags");
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/forum");
    revalidatePath("/community");
    revalidatePath("/groups");
    revalidatePath("/members");
    redirect(
      `${back}?ok=${encodeURIComponent(
        `${parsed.data.key} ${parsed.data.enabled ? "enabled" : "disabled"}.`,
      )}`,
    );
  } catch (error) {
    const mapped = adminActionError(error);
    if (mapped) redirect(`${back}?error=${encodeURIComponent(mapped.error)}`);
    throw error;
  }
}
