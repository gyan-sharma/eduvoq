"use server";

import { revalidatePath } from "next/cache";
import { BookingStatus, Role } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  completeBookingSchema,
  setAvailabilitySchema,
  setMeetingUrlSchema,
} from "@/lib/validators/booking";
import { prisma } from "@/server/db";
import { requireRole, requireSession } from "@/server/rbac";

export type ExpertActionState = {
  ok?: boolean;
  error?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function actionError(error: unknown): ExpertActionState {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return { error: "Please log in." };
    }
    if (error.message === "FORBIDDEN") {
      return { error: "You cannot update this booking." };
    }
  }
  logger.error({ err: error }, "expert action failed");
  return { error: "Unable to save." };
}

async function loadManagedBooking(bookingId: string, userId: string, role: Role) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return null;
  const allowed =
    booking.expertId === userId || role === Role.STAFF || role === Role.ADMIN;
  if (!allowed) throw new Error("FORBIDDEN");
  return booking;
}

export async function setMeetingUrl(
  _prev: ExpertActionState,
  formData: FormData,
): Promise<ExpertActionState> {
  const parsed = setMeetingUrlSchema.safeParse({
    bookingId: String(formData.get("bookingId") ?? ""),
    meetingUrl: String(formData.get("meetingUrl") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    const user = await requireSession();
    const booking = await loadManagedBooking(
      parsed.data.bookingId,
      user.id,
      user.role,
    );
    if (!booking) return { error: "Booking not found." };

    await prisma.booking.update({
      where: { id: booking.id },
      data: { meetingUrl: parsed.data.meetingUrl },
    });
    revalidatePath("/account/bookings");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function completeBooking(
  _prev: ExpertActionState,
  formData: FormData,
): Promise<ExpertActionState> {
  const parsed = completeBookingSchema.safeParse({
    bookingId: String(formData.get("bookingId") ?? ""),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    const user = await requireSession();
    const booking = await loadManagedBooking(
      parsed.data.bookingId,
      user.id,
      user.role,
    );
    if (!booking) return { error: "Booking not found." };
    if (booking.status !== BookingStatus.CONFIRMED) {
      return { error: "Only confirmed sessions can be marked complete." };
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED },
    });
    revalidatePath("/account/bookings");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function setAvailability(
  _prev: ExpertActionState,
  formData: FormData,
): Promise<ExpertActionState> {
  const raw = String(formData.get("windows") ?? "[]");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { error: "Invalid availability payload." };
  }
  const parsed = setAvailabilitySchema.safeParse({ windows: parsedJson });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  for (const window of parsed.data.windows) {
    if (window.endMin <= window.startMin) {
      return { error: "Each window must end after it starts." };
    }
  }

  try {
    const user = await requireRole(Role.EXPERT, Role.STAFF, Role.ADMIN);
    if (user.role !== Role.EXPERT) {
      return { error: "Staff set expert hours from admin (later)." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.expertAvailability.deleteMany({ where: { expertId: user.id } });
      if (parsed.data.windows.length === 0) return;
      await tx.expertAvailability.createMany({
        data: parsed.data.windows.map((window) => ({
          expertId: user.id,
          weekday: window.weekday,
          startMin: window.startMin,
          endMin: window.endMin,
          timezone: "Asia/Kolkata",
        })),
      });
    });
    revalidatePath("/account/bookings");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
