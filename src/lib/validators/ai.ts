import { z } from "zod";

import { BOARD_VALUES, CLASS_LEVELS } from "@/lib/resource-meta";

export const lessonPlanAssistSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(8, "Describe the topic in at least 8 characters.")
    .max(500, "Keep the topic under 500 characters."),
  board: z.enum(BOARD_VALUES).optional(),
  classLevel: z.enum(CLASS_LEVELS).optional(),
  subject: z
    .string()
    .trim()
    .max(64, "Keep the subject under 64 characters.")
    .optional(),
  durationMinutes: z
    .number()
    .int()
    .min(15, "Duration must be at least 15 minutes.")
    .max(180, "Duration must be 180 minutes or less.")
    .optional(),
});

export const blogDraftAssistSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(8, "Describe the topic in at least 8 characters.")
    .max(500, "Keep the topic under 500 characters."),
  audience: z
    .string()
    .trim()
    .max(200, "Keep the audience under 200 characters.")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(4000, "Keep notes under 4,000 characters.")
    .optional(),
});

export type LessonPlanAssistInput = z.infer<typeof lessonPlanAssistSchema>;
export type BlogDraftAssistInput = z.infer<typeof blogDraftAssistSchema>;
