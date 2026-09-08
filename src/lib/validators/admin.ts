import { z } from "zod";

import { FLAG_KEYS } from "@/lib/flags";

export const userIdSchema = z.object({
  userId: z.string().min(1),
});

export const cmsPageSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required.")
    .max(191)
    .regex(
      /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/,
      "Use lowercase letters, numbers, hyphens, and slashes.",
    ),
  title: z.string().trim().min(2, "Title is required.").max(191),
  seoTitle: z.string().trim().max(191).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  published: z.boolean(),
  bodyJson: z.string().min(2, "Page body is required."),
});

export const moderatePostSchema = z.object({
  postId: z.string().min(1),
  decision: z.enum(["publish", "reject"]),
});

export const reportDecisionSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["dismiss", "action"]),
});

export const resourcePublishSchema = z.object({
  resourceId: z.string().min(1),
  decision: z.enum(["publish", "reject"]),
});

export const orderFulfillSchema = z.object({
  orderId: z.string().min(1),
});

export const bookingAdminSchema = z.object({
  bookingId: z.string().min(1),
  decision: z.enum(["complete", "no_show", "cancel"]),
});

export const featureFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .refine((key) => FLAG_KEYS.includes(key), "Unknown feature flag."),
  enabled: z.boolean(),
});
