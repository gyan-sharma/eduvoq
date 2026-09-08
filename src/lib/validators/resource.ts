import { z } from "zod";
import { BOARD_VALUES, CLASS_LEVELS } from "@/lib/resource-meta";

export const resourceKindSchema = z.enum([
  "LEARNING_MATERIAL",
  "CLASS_NOTES",
  "SAMPLE_PAPER",
  "LESSON_PLAN",
  "SYLLABUS",
  "OTHER",
]);

export const boardSchema = z.enum(BOARD_VALUES);

export const uploadResourceSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(191),
  kind: resourceKindSchema,
  board: boardSchema.optional(),
  classLevel: z.enum(CLASS_LEVELS).optional(),
  subject: z.string().trim().max(64).optional(),
});

export const updateResourceMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(191),
  board: boardSchema.optional(),
  classLevel: z.enum(CLASS_LEVELS).optional(),
  subject: z.string().trim().max(64).optional(),
});
