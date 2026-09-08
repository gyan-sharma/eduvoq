"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BookingStatus,
  NotificationType,
  Prisma,
  Role,
  type ConsultationService,
} from "@prisma/client";
import {
  sendBookingCreatedEmail,
  sendExpertBookingEmail,
} from "@/lib/email";
import { logger } from "@/lib/logger";
import { PaymentError } from "@/lib/payments/gateway";
import type { RazorpayClientCheckout } from "@/lib/payments/types";
import { formatKolkata, normalizeToKolkataMinute } from "@/lib/kolkata";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  cancelBookingSchema,
  createBookingSchema,
} from "@/lib/validators/booking";
import {
  lockExpertInterval,
  pickExpertsForSlot,
} from "@/server/booking-assign";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";
import { isAlreadyPaidCheckout } from "@/lib/payments/types";
import { startBookingCheckout } from "@/server/payments";
import { requireBooker, requireSession } from "@/server/rbac";

export type BookingActionState = {
  ok?: boolean;
  error?: string;
  bookingId?: string;
  razorpay?: RazorpayClientCheckout;
} | null;

class SlotTakenError extends Error {
  constructor() {
    super("SLOT_TAKEN");
    this.name = "SlotTakenError";
  }
}

class IntervalConflictError extends Error {
  constructor() {
    super("INTERVAL_CONFLICT");
    this.name = "IntervalConflictError";
  }
}

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function actionError(error: unknown): BookingActionState {
  if (error instanceof SlotTakenError || error instanceof IntervalConflictError) {
    return { error: "That time is no longer available. Pick another slot." };
  }
  if (error instanceof PaymentError) return { error: error.message };
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return { error: "Please log in to book a consultation." };
    }
    if (error.message === "FORBIDDEN") {
      return {
        error:
          "Only verified adult members can book. Students cannot book consultations.",
      };
    }
    if (error.message === "BOOKINGS_OFF") {
      return { error: "Consultations are temporarily unavailable." };
    }
  }
  logger.error({ err: error }, "booking action failed");
  return { error: "Unable to save this booking." };
}

async function loadActiveService(slug: string): Promise<ConsultationService | null> {
  return prisma.consultationService.findFirst({
    where: { slug, isActive: true },
  });
}

export async function createBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = createBookingSchema.safeParse({
    serviceSlug: String(formData.get("serviceSlug") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    gateway: String(formData.get("gateway") ?? "razorpay"),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (!(await isFlagEnabled("bookings"))) {
    return { error: "Consultations are temporarily unavailable." };
  }

  let user;
  try {
    user = await requireBooker();
  } catch (error) {
    return actionError(error);
  }

  const service = await loadActiveService(parsed.data.serviceSlug);
  if (!service) return { error: "That consultation is not available." };

  const requested = new Date(parsed.data.startsAt);
  if (Number.isNaN(requested.getTime())) {
    return { error: "Choose a valid time slot." };
  }
  const startsAt = normalizeToKolkataMinute(requested);
  if (startsAt.getTime() <= Date.now()) {
    return { error: "That time has already passed." };
  }
  const endsAt = new Date(
    startsAt.getTime() + service.durationMinutes * 60 * 1000,
  );
  const notes = parsed.data.notes?.trim() || null;

  let exclude: string[] = [];
  let createdId: string | null = null;
  let createdExpertId: string | null = null;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const created = await prisma.$transaction(
          async (tx) => {
            const ranked = await pickExpertsForSlot(
              tx,
              service,
              startsAt,
              endsAt,
              exclude,
            );
            const chosen = service.expertId
              ? ranked.find((id) => id === service.expertId)
              : ranked[0];
            if (!chosen) throw new SlotTakenError();
            exclude = [chosen];
            const free = await lockExpertInterval(tx, chosen, startsAt, endsAt);
            if (!free) throw new IntervalConflictError();
            return tx.booking.create({
              data: {
                serviceId: service.id,
                expertId: chosen,
                customerId: user.id,
                startsAt,
                endsAt,
                status: BookingStatus.PENDING_PAYMENT,
                notes,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
        createdId = created.id;
        createdExpertId = created.expertId;
        break;
      } catch (error) {
        if (error instanceof SlotTakenError) throw error;
        const retryable =
          isUniqueConstraintError(error) ||
          error instanceof IntervalConflictError;
        if (retryable && attempt === 0 && !service.expertId) {
          continue;
        }
        if (retryable) throw new SlotTakenError();
        throw error;
      }
    }
  } catch (error) {
    return actionError(error);
  }

  if (!createdId || !createdExpertId) {
    return { error: "That time is no longer available. Pick another slot." };
  }

  const [expert, customer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: createdExpertId },
      select: { email: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true },
    }),
  ]);

  const whenLabel = formatKolkata(startsAt);
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: NotificationType.BOOKING,
      title: "Consultation booked",
      body: `${service.title} on ${whenLabel}. Payment is pending.`,
      href: "/account/bookings",
    },
  });

  if (customer?.email) {
    await sendBookingCreatedEmail({
      to: customer.email,
      title: service.title,
      whenLabel,
      meetingUrl: null,
      expertName: expert?.name ?? null,
    });
  }
  if (expert?.email) {
    await sendExpertBookingEmail({
      to: expert.email,
      title: service.title,
      whenLabel,
      customerName: customer?.name ?? null,
    });
  }

  revalidatePath("/account/bookings");
  revalidatePath(`/book/${service.slug}`);

  if (service.pricePaise < 1) {
    redirect(`/account/bookings?booked=${createdId}`);
  }

  let start: Awaited<ReturnType<typeof startBookingCheckout>>;
  try {
    start = await startBookingCheckout({
      bookingId: createdId,
      user: { id: user.id, email: user.email, name: user.name },
      gateway: parsed.data.gateway,
    });
  } catch (error) {
    const failed = actionError(error);
    return {
      ok: failed?.ok,
      razorpay: failed?.razorpay,
      bookingId: createdId,
      error:
        failed?.error ??
        "Booking held for 15 minutes. Complete payment from My bookings.",
    };
  }
  if (isAlreadyPaidCheckout(start)) {
    redirect(`${start.returnPath}?paid=1`);
  }
  if (start.gateway === "stripe") {
    redirect(start.redirectUrl);
  }
  return { ok: true, bookingId: createdId, razorpay: start.razorpay };
}

export async function cancelBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = cancelBookingSchema.safeParse({
    bookingId: String(formData.get("bookingId") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    const user = await requireSession();
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
    });
    if (!booking) return { error: "Booking not found." };

    const isOwner = booking.customerId === user.id;
    const isExpert = booking.expertId === user.id && user.role === Role.EXPERT;
    const isStaff = user.role === Role.STAFF || user.role === Role.ADMIN;
    if (!isOwner && !isExpert && !isStaff) {
      throw new Error("FORBIDDEN");
    }

    if (
      booking.status !== BookingStatus.PENDING_PAYMENT &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      return { error: "This booking can no longer be cancelled." };
    }

    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      await prisma.booking.delete({ where: { id: booking.id } });
    } else {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });
    }

    revalidatePath("/account/bookings");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
