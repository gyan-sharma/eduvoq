import { describe, expect, it } from "vitest";

import {
  DEMO_FEED_POSTS,
  DEMO_FORUM_CATEGORIES,
  DEMO_FORUM_THREADS,
  DEMO_GROUPS,
  DEMO_MEMBERS,
  getDemoForumCategory,
  getDemoForumThread,
  getDemoGroup,
  getDemoMember,
  isDemoUsername,
} from "@/lib/demo-content";
import { FLAG_DEFAULTS, FLAG_DEMO_MODE, FLAG_KEYS } from "@/lib/flags";

describe("demo mode catalog", () => {
  it("defaults demo_mode off and lists it as a known flag", () => {
    expect(FLAG_DEMO_MODE).toBe("demo_mode");
    expect(FLAG_KEYS).toContain("demo_mode");
    expect(FLAG_DEFAULTS.demo_mode).toBe(false);
  });

  it("uses unique forum, group, and member slugs", () => {
    const categorySlugs = DEMO_FORUM_CATEGORIES.map((item) => item.slug);
    expect(new Set(categorySlugs).size).toBe(categorySlugs.length);

    const threadKeys = DEMO_FORUM_THREADS.map(
      (thread) => `${thread.categorySlug}/${thread.slug}`,
    );
    expect(new Set(threadKeys).size).toBe(threadKeys.length);

    const groupSlugs = DEMO_GROUPS.map((group) => group.slug);
    expect(new Set(groupSlugs).size).toBe(groupSlugs.length);

    const usernames = DEMO_MEMBERS.map((member) => member.username);
    expect(new Set(usernames).size).toBe(usernames.length);
    expect(usernames.every(isDemoUsername)).toBe(true);
  });

  it("looks up dummy pages by slug", () => {
    expect(getDemoForumCategory("curriculum-development")?.name).toBe(
      "Curriculum Development",
    );
    expect(
      getDemoForumThread(
        "curriculum-development",
        "nep-unit-plans-without-busywork",
      )?.title,
    ).toMatch(/NEP unit plans/);
    expect(getDemoGroup("job-alerts")?.name).toBe("Job Alerts");
    expect(getDemoMember("demo-ananya")?.displayName).toBe("Ananya Iyer");
    expect(DEMO_FEED_POSTS.length).toBeGreaterThan(0);
  });
});
