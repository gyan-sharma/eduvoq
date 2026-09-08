import { Board } from "@prisma/client";
import { z } from "zod";
import { STUDENT_GRADES } from "@/lib/profile-privacy";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,32}$/,
    "Username must be 3–32 characters: lowercase letters, numbers, or underscore.",
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export function parseStringList(value: string, maxItems = 20): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

const boardValues = [
  Board.CBSE,
  Board.ICSE,
  Board.IB,
  Board.STATE_BOARD,
  Board.KVS,
  Board.NVS,
  Board.OTHER,
] as const;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(191),
  username: usernameSchema,
  headline: optionalText(191),
  bio: optionalText(4000),
  schoolName: optionalText(191),
  city: optionalText(96),
  state: optionalText(96),
  boardAffiliation: z
    .string()
    .transform((value) => {
      if (!value) return null;
      return (boardValues as readonly string[]).includes(value)
        ? (value as (typeof boardValues)[number])
        : null;
    }),
  subjects: z.string().max(1000).optional(),
  classesTaught: z.string().max(1000).optional(),
  linkedinUrl: z
    .string()
    .trim()
    .max(191)
    .optional()
    .refine(
      (value) =>
        !value ||
        /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(value),
      "Enter a full https:// LinkedIn URL.",
    )
    .transform((value) => (value ? value : null)),
});

export const updateSettingsSchema = z.object({
  isProfilePublic: z.boolean(),
});

export const studentProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  grade: z.string().transform((value) => {
    if (!value) return null;
    return (STUDENT_GRADES as readonly string[]).includes(value)
      ? value
      : null;
  }),
  username: usernameSchema,
});

export const childPrivacySchema = z.object({
  childId: z.string().min(1),
  isProfilePublic: z.boolean(),
  grade: z.string().transform((value) => {
    if (!value) return null;
    return (STUDENT_GRADES as readonly string[]).includes(value)
      ? value
      : null;
  }),
});

export const followUsernameSchema = z.object({
  username: usernameSchema,
});
