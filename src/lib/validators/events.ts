import { z } from "zod";

export const registerForEventSchema = z.object({
  eventId: z.string().min(1),
});

export const eventFormSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(4, "Title must be at least 4 characters.").max(191),
  slug: z
    .string()
    .trim()
    .max(191)
    .optional()
    .transform((value) => value?.trim() || undefined),
  startsAt: z.string().min(1, "Start time is required."),
  endsAt: z.string().optional(),
  location: z.string().trim().max(191).optional(),
  isOnline: z.boolean(),
  capacity: z.string().optional(),
  priceRupees: z.string().optional(),
  published: z.boolean(),
  bodyJson: z.string().min(2, "Description is required."),
});
