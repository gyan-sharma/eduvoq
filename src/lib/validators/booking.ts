import { z } from "zod";
import { checkoutGatewaySchema } from "@/lib/validators/payments";

export const createBookingSchema = z.object({
  serviceSlug: z.string().trim().min(1).max(191),
  startsAt: z.string().min(1, "Choose a time slot."),
  notes: z.string().max(2000, "Notes are too long."),
  gateway: checkoutGatewaySchema,
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
});

export const setMeetingUrlSchema = z.object({
  bookingId: z.string().min(1),
  meetingUrl: z
    .string()
    .trim()
    .max(512)
    .refine((value) => {
      if (!value) return false;
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a valid meeting URL."),
});

export const completeBookingSchema = z.object({
  bookingId: z.string().min(1),
});

export const availabilityWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
});

export const setAvailabilitySchema = z.object({
  windows: z.array(availabilityWindowSchema).max(21),
});
