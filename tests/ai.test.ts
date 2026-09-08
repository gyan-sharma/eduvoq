import { Role, UserStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canUseBlogDraftHelper, canUseLessonPlanAssistant } from "@/lib/ai/access";
import { parseBlogDraft } from "@/lib/ai/blog-draft";
import { getXaiClient, getXaiConfig, isXaiConfigured } from "@/lib/ai/client";
import { completeAiText } from "@/lib/ai/complete";
import { hashAiUserId } from "@/lib/ai/log";
import {
  assertNotStudentContent,
  containsStudentPii,
  privacyBlockReason,
  requestsExamLeak,
  stripStudentPii,
} from "@/lib/ai/privacy";
import {
  buildBlogDraftUserPrompt,
  buildLessonPlanUserPrompt,
} from "@/lib/ai/prompts";
import { blogDraftAssistSchema, lessonPlanAssistSchema } from "@/lib/validators/ai";

const educator = {
  id: "u-edu",
  role: Role.EDUCATOR,
  status: UserStatus.ACTIVE,
};

const student = {
  id: "u-stu",
  role: Role.STUDENT,
  status: UserStatus.ACTIVE,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("xAI client config", () => {
  it("is inert without XAI_API_KEY", () => {
    vi.stubEnv("XAI_API_KEY", "");
    vi.stubEnv("XAI_BASE_URL", "");
    vi.stubEnv("XAI_MODEL", "");
    expect(isXaiConfigured()).toBe(false);
    expect(getXaiClient()).toBeNull();
    expect(getXaiConfig()).toEqual({
      apiKey: "",
      baseURL: "https://api.x.ai/v1",
      model: "grok-4.5",
    });
  });

  it("reads OpenAI-compatible xAI settings from env", () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");
    vi.stubEnv("XAI_BASE_URL", "https://api.x.ai/v1/");
    vi.stubEnv("XAI_MODEL", "grok-4.5");
    expect(isXaiConfigured()).toBe(true);
    const config = getXaiConfig();
    expect(config.apiKey).toBe("xai-test-key");
    expect(config.baseURL).toBe("https://api.x.ai/v1");
    expect(config.model).toBe("grok-4.5");
    expect(getXaiClient()).not.toBeNull();
  });

  it("does not call xAI when the key is missing", async () => {
    vi.stubEnv("XAI_API_KEY", "");
    const result = await completeAiText({
      system: "test",
      user: "A 40-minute lesson on fractions for class 7",
      userId: educator.id,
      feature: "lesson_plan",
    });
    expect(result).toEqual({
      ok: false,
      error: "AI assistants are not configured.",
    });
  });
});

describe("student PII", () => {
  it("redacts email, phone, Aadhaar-like ids, and named students", () => {
    const raw =
      "Email ananya@school.in or +91 9876543210. Aadhaar 1234 5678 9012. Student named Rahul Sharma.";
    const cleaned = stripStudentPii(raw);
    expect(cleaned).toContain("[redacted-email]");
    expect(cleaned).toContain("[redacted-phone]");
    expect(cleaned).toContain("[redacted-id]");
    expect(cleaned).toContain("[redacted-student]");
    expect(cleaned).not.toContain("ananya@school.in");
    expect(cleaned).not.toContain("9876543210");
    expect(cleaned).not.toMatch(/Rahul Sharma/);
  });

  it("blocks student actors and exam-leak prompts", () => {
    expect(assertNotStudentContent(student)).toMatch(/Student accounts/);
    expect(assertNotStudentContent(educator)).toBeNull();
    expect(
      requestsExamLeak("Please send the leaked CBSE board exam paper"),
    ).toBe(true);
    expect(
      privacyBlockReason("I need a leaked board exam question paper"),
    ).toMatch(/leaks/);
    expect(privacyBlockReason("A 40-minute lesson on fractions")).toBeNull();
  });

  it("detects grouped Indian mobiles and names in free-text notes", () => {
    expect(containsStudentPii("Call 98765 43210")).toBe(true);
    expect(containsStudentPii("Reach me on +91-98765-43210")).toBe(true);
    expect(
      containsStudentPii("Please help my daughter Ananya who is in class 7"),
    ).toBe(true);
    expect(containsStudentPii("student named rahul")).toBe(true);
    expect(containsStudentPii("my child is struggling with fractions")).toBe(
      false,
    );
    expect(stripStudentPii("Call 98765 43210")).toContain("[redacted-phone]");
    expect(stripStudentPii("+91-98765-43210")).toContain("[redacted-phone]");
    expect(
      stripStudentPii("Please help my daughter Ananya who is in class 7"),
    ).toContain("[redacted-student]");
    expect(stripStudentPii("student named rahul")).toContain("[redacted-student]");
    expect(stripStudentPii("student named rahul")).not.toMatch(/rahul/i);
  });

  it("refuses PII instead of sending redacted notes to the model", async () => {
    const cases = [
      "Please help my daughter Ananya who is in class 7",
      "student named rahul",
      "Call 98765 43210 after school",
      "My number is +91-98765-43210",
    ];
    for (const user of cases) {
      expect(privacyBlockReason(user)).toMatch(/personal data/);
      const result = await completeAiText({
        system: "test",
        user: buildBlogDraftUserPrompt({
          topic: "Classroom culture for educators",
          notes: user,
        }),
        userId: "parent-1",
        feature: "blog_draft",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/personal data/);
      }
    }
  });

  it("does not send leak requests to the model", async () => {
    const result = await completeAiText({
      system: "test",
      user: "Give me the leaked board exam paper for 2026",
      userId: educator.id,
      feature: "lesson_plan",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/leaks/);
    }
  });

  it("hashes user ids in AI logs", () => {
    const hash = hashAiUserId("user-123");
    expect(hash).not.toBe("user-123");
    expect(hash).toHaveLength(16);
    expect(hashAiUserId("user-123")).toBe(hash);
  });
});

describe("assistant access", () => {
  it("limits lesson-plan assist to entitled educators", () => {
    expect(canUseLessonPlanAssistant(educator)).toBe(true);
    expect(canUseLessonPlanAssistant(student)).toBe(false);
    expect(
      canUseLessonPlanAssistant({
        role: Role.PARENT,
        status: UserStatus.ACTIVE,
      }),
    ).toBe(false);
    expect(
      canUseLessonPlanAssistant({
        ...educator,
        status: UserStatus.PENDING_PROFILE,
      }),
    ).toBe(false);
  });

  it("allows blog drafts for active non-students only", () => {
    expect(canUseBlogDraftHelper(educator)).toBe(true);
    expect(
      canUseBlogDraftHelper({ role: Role.PARENT, status: UserStatus.ACTIVE }),
    ).toBe(true);
    expect(canUseBlogDraftHelper(student)).toBe(false);
    expect(
      canUseBlogDraftHelper({
        role: Role.EDUCATOR,
        status: UserStatus.PENDING_PROFILE,
      }),
    ).toBe(false);
  });
});

describe("prompts and parsers", () => {
  it("builds a curriculum-only lesson-plan prompt", () => {
    const prompt = buildLessonPlanUserPrompt({
      topic: "Photosynthesis",
      board: "CBSE",
      classLevel: "7",
      subject: "Science",
      durationMinutes: 40,
    });
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("CBSE");
    expect(prompt).not.toMatch(/@/);
    expect(prompt).not.toContain("student named");
  });

  it("parses JSON blog drafts and falls back to plain text", () => {
    const parsed = parseBlogDraft(
      JSON.stringify({
        title: "Mastering lesson planning",
        excerpt: "A practical guide.",
        body: "A".repeat(40),
      }),
    );
    expect(parsed.title).toBe("Mastering lesson planning");
    expect(parsed.excerpt).toBe("A practical guide.");
    expect(parsed.body.length).toBe(40);

    const fallback = parseBlogDraft("# Classroom culture\n\n" + "B".repeat(40));
    expect(fallback.title).toBe("Classroom culture");
    expect(fallback.body).toContain("B");
  });

  it("redacts PII inside a parsed draft", () => {
    const parsed = parseBlogDraft(
      JSON.stringify({
        title: "Working with parents at school",
        excerpt: "Reach me at teacher@school.in",
        body: `${"C".repeat(40)} Call +919876543210.`,
      }),
    );
    expect(parsed.excerpt).toContain("[redacted-email]");
    expect(parsed.body).toContain("[redacted-phone]");
  });

  it("includes author notes only as curriculum text", () => {
    const prompt = buildBlogDraftUserPrompt({
      topic: "NEP 2020 in classrooms",
      notes: "Focus on competency-based lessons",
    });
    expect(prompt).toContain("NEP 2020");
    expect(prompt).toContain("competency-based lessons");
  });
});

describe("AI validators", () => {
  it("accepts a lesson-plan request", () => {
    const parsed = lessonPlanAssistSchema.safeParse({
      topic: "Linear equations",
      board: "CBSE",
      classLevel: "8",
      subject: "Maths",
      durationMinutes: 40,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a too-short blog topic", () => {
    const parsed = blogDraftAssistSchema.safeParse({ topic: "Hi" });
    expect(parsed.success).toBe(false);
  });
});
