"use server";

import { PostKind, PostStatus, Prisma, Role, UserStatus } from "@prisma/client";
import type { ZodError } from "zod";

import { plainTextToDoc, textFromTipTap } from "@/content/tiptap";
import { allowBlogSubmitForUser } from "@/lib/rate-limit";
import { RESERVED_POST_SLUGS, slugify, uniqueCandidate } from "@/lib/slug";
import { submitBlogSchema } from "@/lib/validators/blog";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export type BlogSubmitState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<"title" | "excerpt" | "body", string>>;
} | null;

function fieldErrorsFromZod(
  error: ZodError,
): NonNullable<BlogSubmitState>["fieldErrors"] {
  const fieldErrors: NonNullable<BlogSubmitState>["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "title" || key === "excerpt" || key === "body") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}

function excerptFrom(body: string, provided: string): string {
  if (provided) return provided;
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= 280) return compact;
  return `${compact.slice(0, 277).trimEnd()}…`;
}

async function allocateSlug(title: string): Promise<string> {
  let base = slugify(title);
  if (RESERVED_POST_SLUGS.has(base)) {
    base = `${base}-post`;
  }
  for (let n = 1; n < 50; n += 1) {
    const candidate = uniqueCandidate(base, n);
    const taken = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return uniqueCandidate(`${base}-${Date.now().toString(36)}`, 1);
}

export async function submitBlog(
  _prev: BlogSubmitState,
  formData: FormData,
): Promise<BlogSubmitState> {
  const honeypot = String(formData.get("website") ?? "");
  if (honeypot.trim() !== "") {
    return {
      ok: true,
      message: "Thanks — your post is in review and is not public yet.",
    };
  }

  let user;
  try {
    user = await requireSession();
  } catch {
    return { error: "Please log in to submit a post." };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { error: "Your account must be active before you can submit a post." };
  }
  if (user.role === Role.STUDENT) {
    return { error: "Student accounts cannot submit blog posts." };
  }
  if (!allowBlogSubmitForUser(user.id)) {
    return { error: "You have submitted several drafts recently. Please wait before sending another." };
  }

  const parsed = submitBlogSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const excerpt = excerptFrom(parsed.data.body, parsed.data.excerpt ?? "");
  const bodyJson = plainTextToDoc(parsed.data.body);
  const bodyText = textFromTipTap(bodyJson) || parsed.data.body;

  try {
    const slug = await allocateSlug(parsed.data.title);
    await prisma.post.create({
      data: {
        slug,
        title: parsed.data.title,
        excerpt,
        bodyJson: bodyJson as Prisma.InputJsonValue,
        bodyText,
        kind: PostKind.BLOG,
        status: PostStatus.IN_REVIEW,
        authorId: user.id,
        seoTitle: parsed.data.title,
        seoDescription: excerpt.slice(0, 320),
      },
    });
  } catch {
    return {
      error:
        "Could not save your draft. Email hello@eduvoq.com if this keeps happening.",
    };
  }

  return {
    ok: true,
    message: "Thanks — your post is in review and is not public yet.",
  };
}
