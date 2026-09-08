"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { emptyDoc, parseTipTapDoc, textFromTipTap } from "@/content/tiptap";
import {
  assertOriginalEventCopy,
  eventRegistrationStatus,
} from "@/lib/events";
import {
  parseKolkataDateTimeLocal,
} from "@/lib/kolkata";
import { logger } from "@/lib/logger";
import { parseRupeesToPaise } from "@/lib/money";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { slugify, uniqueCandidate } from "@/lib/slug";
import {
  eventFormSchema,
  registerForEventSchema,
} from "@/lib/validators/events";
import {
  adminActionError,
  isNextNavigationError,
  requireStaff,
  type AdminActionState,
} from "@/server/admin";
import { writeAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { lockEventForUpdate } from "@/server/events";
import { isFlagEnabled } from "@/server/flags";
import { requireActiveUser } from "@/server/rbac";

export type EventActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function formBool(value: FormDataEntryValue | null): boolean {
  const raw = String(value ?? "").toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}

async function allocateEventSlug(title: string, preferred?: string) {
  const base = slugify(preferred || title);
  for (let n = 1; n < 50; n += 1) {
    const candidate = uniqueCandidate(base, n);
    const taken = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return uniqueCandidate(`${base}-${Date.now().toString(36)}`, 1);
}

export async function registerForEvent(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = registerForEventSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    const user = await requireActiveUser();
    const registrationEnabled = await isFlagEnabled("events_registration");

    const result = await prisma.$transaction(
      async (tx) => {
        const event = await lockEventForUpdate(tx, parsed.data.eventId);
        if (!event) return { error: "Event not found." } as const;

        const already = await tx.eventRegistration.findUnique({
          where: {
            eventId_userId: { eventId: event.id, userId: user.id },
          },
        });
        const registered = await tx.eventRegistration.count({
          where: { eventId: event.id },
        });
        const decision = eventRegistrationStatus({
          published: event.published,
          registrationEnabled,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          capacity: event.capacity,
          registered,
          alreadyRegistered: Boolean(already),
          pricePaise: event.pricePaise,
        });
        if (!decision.ok) return { error: decision.error } as const;

        await tx.eventRegistration.create({
          data: {
            eventId: event.id,
            userId: user.id,
            status: "REGISTERED",
          },
        });
        return { slug: event.slug } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    if ("error" in result) return { error: result.error };

    revalidatePath("/events");
    revalidatePath(`/events/${result.slug}`);
    return { ok: true, message: "You are registered." };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "Please log in to register." };
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { error: "Your account must be active to register." };
    }
    if (isUniqueConstraintError(error)) {
      return { error: "You are already registered." };
    }
    logger.error({ err: error }, "event registration failed");
    return { error: "Could not complete registration." };
  }
}

export async function saveEvent(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = eventFormSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? "") || undefined,
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    location: String(formData.get("location") ?? "") || undefined,
    isOnline: formBool(formData.get("isOnline")),
    capacity: String(formData.get("capacity") ?? ""),
    priceRupees: String(formData.get("priceRupees") ?? ""),
    published: formBool(formData.get("published")),
    bodyJson: String(formData.get("bodyJson") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  const startsAt = parseKolkataDateTimeLocal(parsed.data.startsAt);
  if (!startsAt) return { error: "Start time must be a valid date and time." };
  const endsRaw = parsed.data.endsAt?.trim() ?? "";
  const endsAt = endsRaw ? parseKolkataDateTimeLocal(endsRaw) : null;
  if (endsRaw && !endsAt) return { error: "End time must be a valid date and time." };
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: "End time must be after the start time." };
  }

  const pricePaise = parseRupeesToPaise(parsed.data.priceRupees ?? "");
  if (pricePaise == null) return { error: "Price must be a number in rupees." };

  let capacity: number | null = null;
  const capacityRaw = parsed.data.capacity?.trim() ?? "";
  if (capacityRaw) {
    const n = Number(capacityRaw);
    if (!Number.isInteger(n) || n < 1) {
      return { error: "Capacity must be a positive whole number." };
    }
    capacity = n;
  }

  const body = parseTipTapDoc(parsed.data.bodyJson) ?? emptyDoc;
  const descriptionText = textFromTipTap(body);
  if (!descriptionText) return { error: "Write a real event description." };

  try {
    const actor = await requireStaff();
    const existing = parsed.data.id
      ? await prisma.event.findUnique({ where: { id: parsed.data.id } })
      : null;
    if (parsed.data.id && !existing) return { error: "Event not found." };

    const slug = existing
      ? existing.slug
      : await allocateEventSlug(parsed.data.title, parsed.data.slug);

    const copyError = assertOriginalEventCopy(slug, descriptionText);
    if (copyError) return { error: copyError };

    const data = {
      slug,
      title: parsed.data.title,
      descriptionJson: body as Prisma.InputJsonValue,
      startsAt,
      endsAt,
      location: parsed.data.location ?? null,
      isOnline: parsed.data.isOnline,
      capacity,
      pricePaise,
      published: parsed.data.published,
    };

    const event = existing
      ? await prisma.event.update({ where: { id: existing.id }, data })
      : await prisma.event.create({ data });

    await writeAudit({
      actorId: actor.id,
      action: existing ? "event.update" : "event.create",
      entity: "Event",
      entityId: event.id,
      meta: { slug: event.slug, published: event.published },
    });

    revalidatePath("/events");
    revalidatePath(`/events/${event.slug}`);
    revalidatePath("/admin/events");
    revalidatePath("/sitemap.xml");
    redirect(`/admin/events/${event.id}?ok=${encodeURIComponent("Event saved.")}`);
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    const mapped = adminActionError(error);
    if (mapped) return mapped;
    logger.error({ err: error }, "save event failed");
    return { error: "Could not save this event." };
  }
}
