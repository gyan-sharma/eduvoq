import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, info } = vi.hoisted(() => ({
  create: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  getXaiClient: () => ({
    chat: { completions: { create } },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info, error: vi.fn() },
}));

import { completeAiText } from "@/lib/ai/complete";
import { buildBlogDraftUserPrompt } from "@/lib/ai/prompts";

describe("completeAiText provider gate", () => {
  beforeEach(() => {
    create.mockReset();
    info.mockReset();
    vi.stubEnv("XAI_API_KEY", "test-key");
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: "A classroom article about pedagogy in Indian schools.",
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not send PARENT notes containing a child name to xAI", async () => {
    const notes = "Please help my daughter Ananya who is in class 7";
    const result = await completeAiText({
      system: "test",
      user: buildBlogDraftUserPrompt({
        topic: "Classroom culture for educators",
        notes,
      }),
      userId: "parent-1",
      feature: "blog_draft",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/personal data/);
    }
    expect(create).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("does not send grouped Indian mobiles or lowercase named students", async () => {
    for (const notes of [
      "Call 98765 43210",
      "Teacher phone +91-98765-43210",
      "student named rahul needs a lesson on fractions",
    ]) {
      create.mockClear();
      const result = await completeAiText({
        system: "test",
        user: buildBlogDraftUserPrompt({
          topic: "Classroom culture for educators",
          notes,
        }),
        userId: "parent-1",
        feature: "blog_draft",
      });
      expect(result.ok).toBe(false);
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("logs length only — never raw notes or completions", async () => {
    const notes = "Focus on competency-based lessons";
    const result = await completeAiText({
      system: "test",
      user: buildBlogDraftUserPrompt({
        topic: "Classroom culture for educators",
        notes,
      }),
      userId: "parent-1",
      feature: "blog_draft",
    });
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const sent = create.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    expect(sent.messages[1]?.content).toContain("competency-based lessons");
    expect(info).toHaveBeenCalled();
    const payload = info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.prompt).toBeUndefined();
    expect(payload.completion).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("competency-based");
    expect(JSON.stringify(payload)).not.toContain("Ananya");
    expect(typeof payload.promptChars).toBe("number");
    expect(typeof payload.completionChars).toBe("number");
    expect(typeof payload.userHash).toBe("string");
  });
});
