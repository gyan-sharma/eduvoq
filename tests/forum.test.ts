import { Role, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canPostInForum, forumAuthorView, paginationCursor } from "@/lib/forum";
import { allowForumWrite } from "@/lib/rate-limit";
import { collectText, excerptFromDoc, paragraphsFromDoc, toDoc } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";
import {
  createThreadSchema,
  reactSchema,
  replyThreadSchema,
  reportContentSchema,
} from "@/lib/validators/forum";

describe("slugify", () => {
  it("builds a lowercase hyphenated slug", () => {
    expect(slugify("Morning routines that actually stick")).toBe(
      "morning-routines-that-actually-stick",
    );
  });

  it("falls back when the title has no latin characters", () => {
    expect(slugify("!!!")).toBe("item");
  });
});

describe("rich text", () => {
  it("round-trips plain paragraphs without HTML", () => {
    const doc = toDoc("Hello\n\nSecond");
    expect(paragraphsFromDoc(doc)).toEqual(["Hello", "Second"]);
    expect(collectText(doc)).toBe("HelloSecond");
  });

  it("does not treat markup fields as HTML to render", () => {
    const injected = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert(1)</script>" }],
        },
      ],
    };
    expect(paragraphsFromDoc(injected)).toEqual(["<script>alert(1)</script>"]);
    expect(excerptFromDoc(injected, 20)).toMatch(/<script>/);
  });

  it("ignores unknown node types", () => {
    const doc = {
      type: "doc",
      content: [{ type: "rawHtml", html: "<b>nope</b>" }],
    };
    expect(paragraphsFromDoc(doc)).toEqual([]);
  });
});

describe("forumAuthorView", () => {
  const student = {
    id: "stu-1",
    username: "ada_l",
    name: "Ada Lovelace",
    role: Role.STUDENT,
    status: UserStatus.ACTIVE,
    parentId: "par-1",
    isProfilePublic: false,
    image: "https://example.com/ada.jpg",
  };

  it("hides last name, photo, and profile link for a hidden student", () => {
    const view = forumAuthorView(student, null);
    expect(view.displayName).toBe("Ada");
    expect(view.href).toBeNull();
    expect(view.avatarUrl).toBeNull();
  });

  it("lets the parent see the full name and profile", () => {
    const view = forumAuthorView(student, {
      id: "par-1",
      role: Role.PARENT,
      parentId: null,
    });
    expect(view.displayName).toBe("Ada Lovelace");
    expect(view.href).toBe("/members/ada_l");
  });
});

describe("forum validators", () => {
  it("accepts a new thread", () => {
    const parsed = createThreadSchema.safeParse({
      categorySlug: "classroom-management",
      title: "Morning routines",
      body: "What works for you?",
    });
    expect(parsed.success).toBe(true);
  });

  it("stores an empty parentId as null", () => {
    const parsed = replyThreadSchema.safeParse({
      categorySlug: "general",
      threadSlug: "welcome-to-eduvoq-forums",
      parentId: "",
      body: "Thanks.",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.parentId).toBeNull();
  });

  it("rejects an unknown reaction emoji", () => {
    expect(
      reactSchema.safeParse({ postId: "p1", emoji: "🔥" }).success,
    ).toBe(false);
    expect(reactSchema.safeParse({ postId: "p1", emoji: "👍" }).success).toBe(
      true,
    );
  });

  it("accepts a forum post report", () => {
    const parsed = reportContentSchema.safeParse({
      targetType: "FORUM_POST",
      targetId: "p1",
      reason: "spam",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("allowForumWrite", () => {
  it("caps writes per hour", () => {
    const userId = `u-${Math.random().toString(16).slice(2)}`;
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 8; i += 1) {
      expect(allowForumWrite(userId, 8, t0 + i)).toBe(true);
    }
    expect(allowForumWrite(userId, 8, t0 + 9)).toBe(false);
    expect(allowForumWrite(userId, 8, t0 + 60 * 60 * 1000 + 1)).toBe(true);
  });
});

describe("canPostInForum", () => {
  it("allows only ACTIVE members", () => {
    expect(canPostInForum({ status: UserStatus.ACTIVE })).toBe(true);
    expect(canPostInForum({ status: UserStatus.PENDING_PROFILE })).toBe(false);
    expect(canPostInForum(null)).toBe(false);
  });
});

describe("paginationCursor", () => {
  it("ignores missing or stale cursors", () => {
    expect(paginationCursor("nope", undefined)).toBeUndefined();
    expect(paginationCursor("abc", "def")).toBeUndefined();
    expect(paginationCursor("abc", "abc")).toBe("abc");
    expect(paginationCursor(undefined, "abc")).toBeUndefined();
  });
});
