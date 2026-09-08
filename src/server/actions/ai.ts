"use server";

import { canUseBlogDraftHelper, canUseLessonPlanAssistant } from "@/lib/ai/access";
import { parseBlogDraft } from "@/lib/ai/blog-draft";
import { completeAiText } from "@/lib/ai/complete";
import { isAiAvailable } from "@/lib/ai/enabled";
import { assertNotStudentContent } from "@/lib/ai/privacy";
import {
  BLOG_DRAFT_SYSTEM_PROMPT,
  LESSON_PLAN_SYSTEM_PROMPT,
  buildBlogDraftUserPrompt,
  buildLessonPlanUserPrompt,
} from "@/lib/ai/prompts";
import { allowAiAssistForUser } from "@/lib/rate-limit";
import {
  blogDraftAssistSchema,
  lessonPlanAssistSchema,
} from "@/lib/validators/ai";
import { requireSession } from "@/server/rbac";

export type LessonPlanAssistState = {
  ok?: boolean;
  error?: string;
  plan?: string;
} | null;

export type BlogDraftAssistState = {
  ok?: boolean;
  error?: string;
  title?: string;
  excerpt?: string;
  body?: string;
} | null;

function emptyToUndef(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function requireAiUser() {
  let user;
  try {
    user = await requireSession();
  } catch {
    return { error: "Please log in first." as const };
  }
  const studentBlock = assertNotStudentContent(user);
  if (studentBlock) return { error: studentBlock };
  if (!(await isAiAvailable())) {
    return { error: "AI assistants are not available." as const };
  }
  if (!allowAiAssistForUser(user.id)) {
    return {
      error: "You have used the assistant several times recently. Please wait." as const,
    };
  }
  return { user };
}

export async function generateLessonPlan(
  _prev: LessonPlanAssistState,
  formData: FormData,
): Promise<LessonPlanAssistState> {
  const gate = await requireAiUser();
  if ("error" in gate) return { error: gate.error };
  const { user } = gate;

  if (!canUseLessonPlanAssistant(user)) {
    return {
      error:
        "Lesson-plan assist is for active EDUCATOR, EXPERT, STAFF, or ADMIN accounts.",
    };
  }

  const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
  const durationMinutes = durationRaw ? Number(durationRaw) : undefined;

  const parsed = lessonPlanAssistSchema.safeParse({
    topic: String(formData.get("topic") ?? ""),
    board: emptyToUndef(String(formData.get("board") ?? "")),
    classLevel: emptyToUndef(String(formData.get("classLevel") ?? "")),
    subject: emptyToUndef(String(formData.get("subject") ?? "")),
    durationMinutes:
      durationMinutes != null && Number.isFinite(durationMinutes)
        ? durationMinutes
        : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await completeAiText({
    system: LESSON_PLAN_SYSTEM_PROMPT,
    user: buildLessonPlanUserPrompt(parsed.data),
    userId: user.id,
    feature: "lesson_plan",
    maxTokens: 2500,
  });
  if (!result.ok) return { error: result.error };
  return { ok: true, plan: result.text };
}

export async function draftBlogPost(
  _prev: BlogDraftAssistState,
  formData: FormData,
): Promise<BlogDraftAssistState> {
  const gate = await requireAiUser();
  if ("error" in gate) return { error: gate.error };
  const { user } = gate;

  if (!canUseBlogDraftHelper(user)) {
    return { error: "Student accounts cannot use the blog draft helper." };
  }

  const parsed = blogDraftAssistSchema.safeParse({
    topic: String(formData.get("topic") ?? ""),
    audience: emptyToUndef(String(formData.get("audience") ?? "")),
    notes: emptyToUndef(String(formData.get("notes") ?? "")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await completeAiText({
    system: BLOG_DRAFT_SYSTEM_PROMPT,
    user: buildBlogDraftUserPrompt(parsed.data),
    userId: user.id,
    feature: "blog_draft",
    maxTokens: 3000,
  });
  if (!result.ok) return { error: result.error };

  const draft = parseBlogDraft(result.text);
  return { ok: true, ...draft };
}
