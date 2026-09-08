import { z } from "zod";

export const emailSchema = z.email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(191),
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
  tos: z.literal(true, { error: "You must accept the Terms of Service." }),
  isParent: z.boolean(),
});

export const completeProfileSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
  tos: z.literal(true, { error: "You must accept the Terms of Service." }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const createChildSchema = z.object({
  name: z.string().trim().min(1, "Child name is required.").max(191),
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the child's date of birth."),
  parentFullName: z.string().trim().min(2, "Type your full name to attest.").max(191),
  attestation: z.literal(true, {
    error: "Parental attestation is required to create a child account.",
  }),
});

export const linkCredentialsSchema = z.object({
  password: passwordSchema,
});
