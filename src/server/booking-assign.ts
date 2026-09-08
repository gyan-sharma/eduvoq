import {
  BookingStatus,
  Role,
  UserStatus,
  type ConsultationService,
  type Prisma,
} from "@prisma/client";
import { addKolkataDays, startOfKolkataDay, toKolkataParts } from "@/lib/kolkata";
import { isAlignedSlot } from "@/lib/slots";

const OCCUPYING: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

type Tx = Prisma.TransactionClient;

export async function pickExpertsForSlot(
  tx: Tx,
  service: ConsultationService,
  startsAt: Date,
  endsAt: Date,
  excludeExpertIds: string[] = [],
): Promise<string[]> {
  const weekday = toKolkataParts(startsAt).weekday;
  const startMin = toKolkataParts(startsAt).minuteOfDay;
  const endMin = startMin + service.durationMinutes;

  const windows = await tx.expertAvailability.findMany({
    where: {
      weekday,
      startMin: { lte: startMin },
      endMin: { gte: endMin },
      expertId: service.expertId
        ? service.expertId
        : excludeExpertIds.length
          ? { notIn: excludeExpertIds }
          : undefined,
      expert: { role: Role.EXPERT, status: UserStatus.ACTIVE },
    },
    select: { expertId: true, weekday: true, startMin: true, endMin: true },
  });

  const aligned = windows.filter((window) =>
    isAlignedSlot({
      durationMinutes: service.durationMinutes,
      startsAt,
      windows: [window],
    }),
  );
  let expertIds = [...new Set(aligned.map((row) => row.expertId))].filter(
    (id) => !excludeExpertIds.includes(id),
  );
  if (service.expertId) {
    expertIds = expertIds.filter((id) => id === service.expertId);
  }
  if (expertIds.length === 0) return [];

  const overlapping = await tx.booking.findMany({
    where: {
      expertId: { in: expertIds },
      status: { in: OCCUPYING },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { expertId: true },
  });
  const busy = new Set(overlapping.map((row) => row.expertId));
  const free = expertIds.filter((id) => !busy.has(id));
  if (free.length === 0) return [];

  const dayStart = startOfKolkataDay(startsAt);
  const dayEnd = addKolkataDays(dayStart, 1);
  const counts = await tx.booking.groupBy({
    by: ["expertId"],
    where: {
      expertId: { in: free },
      status: BookingStatus.CONFIRMED,
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    _count: { _all: true },
  });
  const countByExpert = new Map(
    counts.map((row) => [row.expertId, row._count._all]),
  );
  free.sort((a, b) => {
    const diff = (countByExpert.get(a) ?? 0) - (countByExpert.get(b) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
  return free;
}
