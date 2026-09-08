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
        "Student accounts cannot post on Teacher Social or join groups.",
    };
  }
  if (!isDirectoryRole(user.role)) {
    return {
      ok: false,
      reason: "Teacher Social and groups are for educators.",
    };
  }
  return { ok: true };
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
