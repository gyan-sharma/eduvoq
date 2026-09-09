import { Role, UserStatus } from "@prisma/client";
import { isDirectoryRole } from "@/lib/profile-privacy";
import { textFromTipTap } from "@/lib/tiptap-text";

export const FEED_PAGE_SIZE = 20;
export const FEED_COMMENT_PREVIEW = 8;
export const FEED_COMMENT_FOCUS = 100;
export const MAX_FEED_BODY = 4000;
export const MAX_COMMENT_BODY = 2000;
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 8;

/** Prisma `cuid()` ids are 25 chars starting with `c`. */
export function isCuid(value: string | undefined | null): value is string {
  return typeof value === "string" && /^c[a-z0-9]{20,32}$/i.test(value);
}

export function feedPostHref(id: string): string {
  return `/community?post=${encodeURIComponent(id)}`;
}

const IST = "Asia/Kolkata";

export type CommunityGate =
  | { ok: true }
  | { ok: false; reason: string };

export type PollJson = {
  question: string;
  options: string[];
};

export const GROUP_AUDIENCE_EDUCATOR = "EDUCATOR";
export const GROUP_AUDIENCE_STUDENT = "STUDENT";

export function canUseEducatorCommunity(user: {
  role: Role;
  status: UserStatus;
}): CommunityGate {
  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "Finish activating your account first." };
  }
  if (user.role === Role.STUDENT) {
    return {
      ok: false,
      reason:
        "Student accounts use Student Circle groups and the forum, not Teacher Social posts.",
    };
  }
  if (!isDirectoryRole(user.role)) {
    return {
      ok: false,
      reason: "Teacher Social is for educators. Parents can join student groups.",
    };
  }
  return { ok: true };
}

export function canJoinGroupAudience(
  user: { role: Role; status: UserStatus },
  audience: string,
): CommunityGate {
  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "Finish activating your account first." };
  }
  if (audience === GROUP_AUDIENCE_STUDENT) {
    if (
      user.role === Role.STUDENT ||
      user.role === Role.PARENT ||
      user.role === Role.STAFF ||
      user.role === Role.ADMIN
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "Student Circle groups are for students, parents, and staff.",
    };
  }
  return canUseEducatorCommunity(user);
}

export function defaultGroupAudience(role: Role): string {
  return role === Role.STUDENT ? GROUP_AUDIENCE_STUDENT : GROUP_AUDIENCE_EDUCATOR;
}

export const TARGET_FEED_POST = "FEED_POST";

export function visibleGroupAudiences(role: Role): string[] {
  if (role === Role.STAFF || role === Role.ADMIN) {
    return [GROUP_AUDIENCE_EDUCATOR, GROUP_AUDIENCE_STUDENT];
  }
  if (role === Role.STUDENT || role === Role.PARENT) {
    return [GROUP_AUDIENCE_STUDENT];
  }
  return [GROUP_AUDIENCE_EDUCATOR];
}

export function tallyReactionsByTarget(
  rows: { targetId: string; emoji: string; userId: string }[],
  viewerId: string | null,
): Map<string, { counts: Record<string, number>; mine: string[] }> {
  const map = new Map<string, { counts: Record<string, number>; mine: string[] }>();
  for (const row of rows) {
    let entry = map.get(row.targetId);
    if (!entry) {
      entry = { counts: {}, mine: [] };
      map.set(row.targetId, entry);
    }
    entry.counts[row.emoji] = (entry.counts[row.emoji] ?? 0) + 1;
    if (viewerId && row.userId === viewerId && !entry.mine.includes(row.emoji)) {
      entry.mine.push(row.emoji);
    }
  }
  return map;
}

export function canCreateGroup(user: {
  role: Role;
  status: UserStatus;
}): CommunityGate {
  if (user.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "Finish activating your account first." };
  }
  if (user.role === Role.PARENT) {
    return {
      ok: false,
      reason: "Parents join student groups rather than creating them.",
    };
  }
  if (user.role === Role.STUDENT || isDirectoryRole(user.role)) {
    return { ok: true };
  }
  return { ok: false, reason: "Your account cannot create groups." };
}

export function parsePollJson(value: unknown): PollJson | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const question =
    typeof record.question === "string" ? record.question.trim() : "";
  const raw = Array.isArray(record.options) ? record.options : [];
  const options = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_POLL_OPTIONS);
  if (!question || options.length < MIN_POLL_OPTIONS) return null;
  return { question, options };
}

export function parsePollOptions(text: string): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const option = line.trim();
    if (!option) continue;
    const key = option.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
    if (options.length >= MAX_POLL_OPTIONS) break;
  }
  return options;
}

export function isValidOptionIdx(
  optionCount: number,
  optionIdx: number,
): boolean {
  return (
    Number.isInteger(optionIdx) &&
    optionIdx >= 0 &&
    optionIdx < optionCount
  );
}

export function tallyVotes(
  optionCount: number,
  votes: { optionIdx: number }[],
): number[] {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const vote of votes) {
    if (isValidOptionIdx(optionCount, vote.optionIdx)) {
      counts[vote.optionIdx] += 1;
    }
  }
  return counts;
}

export function displayName(user: {
  name?: string | null;
  username?: string | null;
}): string {
  return user.name?.trim() || user.username || "Educator";
}

export function formatCommunityWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function shouldRenderGroupPostBody(
  bodyJson: unknown,
  poll: PollJson | null,
): boolean {
  if (!poll) return true;
  const text = textFromTipTap(bodyJson);
  return Boolean(text) && text !== poll.question;
}
