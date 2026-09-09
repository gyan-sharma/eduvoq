import { z } from "zod";
import {
  MAX_COMMENT_BODY,
  MAX_FEED_BODY,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  parsePollOptions,
} from "@/lib/community";

export const groupSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,64}$/, "Unknown group."),
});

export const feedPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something to share.")
    .max(MAX_FEED_BODY, "Keep posts under 4,000 characters."),
});

export const feedCommentSchema = z.object({
  feedPostId: z.string().trim().min(1, "Missing post."),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment.")
    .max(MAX_COMMENT_BODY, "Keep comments under 2,000 characters."),
});

export const groupPostSchema = z.object({
  slug: groupSlugSchema.shape.slug,
  body: z
    .string()
    .trim()
    .min(1, "Write a post.")
    .max(MAX_FEED_BODY, "Keep posts under 4,000 characters."),
});

export const createPollSchema = z.object({
  slug: groupSlugSchema.shape.slug,
  question: z
    .string()
    .trim()
    .min(1, "Ask a question.")
    .max(280, "Keep the question under 280 characters."),
  options: z
    .string()
    .transform(parsePollOptions)
    .refine(
      (options) => options.length >= MIN_POLL_OPTIONS,
      "Add at least two options, one per line.",
    )
    .refine(
      (options) => options.length <= MAX_POLL_OPTIONS,
      "Use at most eight options.",
    ),
});

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name needs at least 3 characters.")
    .max(80, "Keep the name under 80 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters.")
    .optional()
    .or(z.literal("")),
});

export const feedReactSchema = z.object({
  postId: z.string().trim().min(1, "Missing post."),
  emoji: z.enum(["👍", "❤️", "💡", "🎉"]),
});

export const votePollSchema = z.object({
  groupPostId: z.string().trim().min(1, "Missing poll."),
  optionIdx: z.coerce
    .number()
    .int("Choose one option.")
    .min(0, "Choose one option."),
});
