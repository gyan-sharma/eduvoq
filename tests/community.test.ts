import { Role, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canCreateGroup,
  canJoinGroupAudience,
  canUseEducatorCommunity,
  defaultGroupAudience,
  feedPostHref,
  isCuid,
  isValidOptionIdx,
  parsePollJson,
  parsePollOptions,
  shouldRenderGroupPostBody,
  tallyVotes,
  visibleGroupAudiences,
} from "@/lib/community";
import { plainTextToDoc, textFromTipTap } from "@/lib/tiptap-text";
import { createPollSchema, votePollSchema } from "@/lib/validators/community";

const educator = {
  role: Role.EDUCATOR,
  status: UserStatus.ACTIVE,
};

const student = {
  role: Role.STUDENT,
  status: UserStatus.ACTIVE,
};

const parent = {
  role: Role.PARENT,
  status: UserStatus.ACTIVE,
};

describe("canUseEducatorCommunity", () => {
  it("allows active educators, experts, staff, and admins", () => {
    expect(canUseEducatorCommunity(educator).ok).toBe(true);
    expect(canUseEducatorCommunity({ ...educator, role: Role.EXPERT }).ok).toBe(
      true,
    );
    expect(canUseEducatorCommunity({ ...educator, role: Role.STAFF }).ok).toBe(
      true,
    );
    expect(canUseEducatorCommunity({ ...educator, role: Role.ADMIN }).ok).toBe(
      true,
    );
  });

  it("blocks students and parents from Teacher Social posts", () => {
    expect(canUseEducatorCommunity(student).ok).toBe(false);
    expect(canUseEducatorCommunity(parent).ok).toBe(false);
  });

  it("blocks inactive accounts", () => {
    expect(
      canUseEducatorCommunity({
        ...educator,
        status: UserStatus.PENDING_PROFILE,
      }).ok,
    ).toBe(false);
  });
});

describe("group audience", () => {
  it("lets students and parents join student groups only", () => {
    expect(canJoinGroupAudience(student, "STUDENT").ok).toBe(true);
    expect(canJoinGroupAudience(parent, "STUDENT").ok).toBe(true);
    expect(canJoinGroupAudience(student, "EDUCATOR").ok).toBe(false);
    expect(canJoinGroupAudience(parent, "EDUCATOR").ok).toBe(false);
    expect(canJoinGroupAudience(educator, "STUDENT").ok).toBe(false);
    expect(canJoinGroupAudience(educator, "EDUCATOR").ok).toBe(true);
  });

  it("lets staff see both audiences and students create student groups", () => {
    expect(visibleGroupAudiences(Role.STAFF)).toEqual(["EDUCATOR", "STUDENT"]);
    expect(visibleGroupAudiences(Role.STUDENT)).toEqual(["STUDENT"]);
    expect(visibleGroupAudiences(Role.EDUCATOR)).toEqual(["EDUCATOR"]);
    expect(defaultGroupAudience(Role.STUDENT)).toBe("STUDENT");
    expect(canCreateGroup(student).ok).toBe(true);
    expect(canCreateGroup(parent).ok).toBe(false);
    expect(canCreateGroup(educator).ok).toBe(true);
  });
});

describe("poll json", () => {
  it("requires a question and at least two options", () => {
    expect(parsePollJson(null)).toBeNull();
    expect(parsePollJson({ question: "A?", options: ["One"] })).toBeNull();
    expect(
      parsePollJson({
        question: " Which board? ",
        options: [" CBSE ", "", "ICSE", 3],
      }),
    ).toEqual({
      question: "Which board?",
      options: ["CBSE", "ICSE"],
    });
  });

  it("parses one option per line and dedupes", () => {
    expect(parsePollOptions("CBSE\ncbse\nICSE\n\nIB")).toEqual([
      "CBSE",
      "ICSE",
      "IB",
    ]);
  });

  it("tallies votes and rejects out-of-range indexes", () => {
    expect(isValidOptionIdx(3, 0)).toBe(true);
    expect(isValidOptionIdx(3, 3)).toBe(false);
    expect(tallyVotes(3, [{ optionIdx: 0 }, { optionIdx: 0 }, { optionIdx: 9 }])).toEqual(
      [2, 0, 0],
    );
  });
});

describe("poll validators", () => {
  it("accepts a well-formed poll", () => {
    const parsed = createPollSchema.safeParse({
      slug: "social-network",
      question: "Which board workshop should we run next?",
      options: "CBSE\nICSE\nIB",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.options).toEqual(["CBSE", "ICSE", "IB"]);
    }
  });

  it("rejects a single-option poll", () => {
    const parsed = createPollSchema.safeParse({
      slug: "job-alerts",
      question: "Only one?",
      options: "Yes",
    });
    expect(parsed.success).toBe(false);
  });

  it("coerces vote indexes", () => {
    const parsed = votePollSchema.safeParse({
      groupPostId: "post_1",
      optionIdx: "1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.optionIdx).toBe(1);
  });
});

describe("tiptap text", () => {
  it("round-trips plain paragraphs", () => {
    const doc = plainTextToDoc("Hello educators.\n\nSecond paragraph.");
    expect(textFromTipTap(doc)).toBe("Hello educators.\nSecond paragraph.");
  });
});

describe("feed ids and permalinks", () => {
  it("accepts Prisma cuid-shaped ids and rejects junk cursors", () => {
    expect(isCuid("clxyz0123456789abcdefghij")).toBe(true);
    expect(isCuid("not-a-cursor")).toBe(false);
    expect(isCuid("")).toBe(false);
    expect(isCuid(undefined)).toBe(false);
  });

  it("builds a post query permalink", () => {
    expect(feedPostHref("clxyz0123456789abcdefghij")).toBe(
      "/community?post=clxyz0123456789abcdefghij",
    );
  });
});

describe("group poll body", () => {
  it("hides body text that only repeats the poll question", () => {
    const question = "Which board workshop should we run next?";
    const poll = { question, options: ["CBSE", "ICSE"] };
    expect(shouldRenderGroupPostBody(plainTextToDoc(question), poll)).toBe(
      false,
    );
    expect(shouldRenderGroupPostBody(plainTextToDoc(""), poll)).toBe(false);
    expect(
      shouldRenderGroupPostBody(plainTextToDoc("Extra context for the poll."), poll),
    ).toBe(true);
    expect(shouldRenderGroupPostBody(plainTextToDoc("A discussion."), null)).toBe(
      true,
    );
  });
});
