import { z } from "zod";
import {
  FORUM_BODY_MAX,
  FORUM_EMOJIS,
  FORUM_TITLE_MAX,
  TARGET_FORUM_POST,
  TARGET_FORUM_THREAD,
} from "@/lib/forum";

const slugField = z
  .string()
  .trim()
  .min(1, "Missing forum path.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid forum path.");

const bodyField = z
  .string()
  .trim()
  .min(1, "Write a post.")
  .max(FORUM_BODY_MAX, `Posts can be at most ${FORUM_BODY_MAX} characters.`);

export const createThreadSchema = z.object({
  categorySlug: slugField,
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(FORUM_TITLE_MAX, `Title can be at most ${FORUM_TITLE_MAX} characters.`),
  body: bodyField,
});

export const replyThreadSchema = z.object({
  categorySlug: slugField,
  threadSlug: slugField,
  parentId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : null)),
  body: bodyField,
});

export const reactSchema = z.object({
  postId: z.string().trim().min(1, "Missing post."),
  emoji: z.enum(FORUM_EMOJIS),
});

export const reportContentSchema = z.object({
  targetType: z.enum([TARGET_FORUM_POST, TARGET_FORUM_THREAD]),
  targetId: z.string().trim().min(1, "Missing target."),
  reason: z.enum(["spam", "harassment", "off_topic", "other"]),
});
