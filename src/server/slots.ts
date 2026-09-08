import {
  BookingStatus,
  Role,
  UserStatus,
  type ConsultationService,
} from "@prisma/client";
import { addKolkataDays, fromKolkata } from "@/lib/kolkata";
import {
  generateSlots,
  uniqueSlotStarts,
  type AvailabilityWindow,
  type OccupiedInterval,
} from "@/lib/slots";
import type { PublicSlot } from "@/lib/types/booking";
import { prisma } from "@/server/db";

export const SLOT_HORIZON_DAYS = 14;
export const SLOT_RANGE_MAX_DAYS = 21;

const OCCUPYING: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

export function parseSlotRange(
  fromParam: string | null,
  toParam: string | null,
  now = new Date(),
): { from: Date; to: Date } | { error: string } {
  const from = parseBound(fromParam, false) ?? now;
  const to = parseBound(toParam, true) ?? addKolkataDays(from, SLOT_HORIZON_DAYS);
  if (to <= from) return { error: "Invalid from/to range." };
  const maxTo = addKolkataDays(from, SLOT_RANGE_MAX_DAYS);
  if (to > maxTo) return { error: "Range cannot exceed 21 days." };
  return { from, to };
}

function parseBound(value: string | null, endOfDay: boolean): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return fromKolkata(year, month, day, endOfDay ? 24 * 60 : 0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function loadSlotInputs(service: ConsultationService): Promise<{
  windows: AvailabilityWindow[];
  occupied: OccupiedInterval[];
}> {
  const expertFilter = service.expertId
    ? { id: service.expertId, role: Role.EXPERT, status: UserStatus.ACTIVE }
    : { role: Role.EXPERT, status: UserStatus.ACTIVE };

  const windows = await prisma.expertAvailability.findMany({
    where: { expert: expertFilter },
    select: { expertId: true, weekday: true, startMin: true, endMin: true },
  });

  const expertIds = [...new Set(windows.map((row) => row.expertId))];
  if (expertIds.length === 0) return { windows, occupied: [] };

  const occupiedRows = await prisma.booking.findMany({
    where: {
      expertId: { in: expertIds },
      status: { in: OCCUPYING },
    },
    select: { expertId: true, startsAt: true, endsAt: true },
  });

  return { windows, occupied: occupiedRows };
}

export async function listPublicSlots(
  service: ConsultationService,
  from: Date,
  to: Date,
  now = new Date(),
): Promise<PublicSlot[]> {
  const { windows, occupied } = await loadSlotInputs(service);
  const generated = generateSlots({
    durationMinutes: service.durationMinutes,
    from,
    to,
    now,
    windows,
    occupied,
  });
  return uniqueSlotStarts(generated).map((slot) => ({
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
  }));
}
