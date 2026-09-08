import { z } from "zod";

export const submitBlogSchema = z.object({
  title: z.string().trim().min(8, "Title must be at least 8 characters").max(255),
  excerpt: z.string().trim().max(2000, "Excerpt must be under 2000 characters"),
  body: z
    .string()
    .trim()
    .min(40, "Write at least a short article (40 characters)")
    .max(20000, "Keep the draft under 20,000 characters"),
});

export type SubmitBlogInput = z.infer<typeof submitBlogSchema>;
