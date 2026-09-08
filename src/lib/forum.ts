import { Role, UserStatus } from "@prisma/client";
import {
  canViewProfile,
  firstName,
  isStudentPublicCard,
  type ProfileViewer,
} from "@/lib/profile-privacy";

export const FORUM_EMOJIS = ["👍", "❤️", "💡", "🎉"] as const;
export type ForumEmoji = (typeof FORUM_EMOJIS)[number];

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Other" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const TARGET_FORUM_POST = "FORUM_POST";
export const TARGET_FORUM_THREAD = "FORUM_THREAD";

export const FORUM_TITLE_MAX = 160;
export const FORUM_BODY_MAX = 8000;
export const FORUM_WRITES_PER_HOUR = 8;

export type ForumAuthor = {
  id: string;
  username: string | null;
  name: string | null;
  role: Role;
  status: UserStatus;
  parentId: string | null;
  isProfilePublic: boolean;
  image: string | null;
};

export type ForumAuthorView = {
  displayName: string;
  href: string | null;
  avatarUrl: string | null;
};

/** Public byline: students stay first-name only; hidden usernames are not linked. */
export function forumAuthorView(
  author: ForumAuthor,
  viewer: ProfileViewer,
): ForumAuthorView {
  const restricted = isStudentPublicCard(author, viewer);
  const displayName = restricted
    ? firstName(author.name)
    : author.name?.trim() || author.username || "Member";
  const href =
    author.username && canViewProfile(author, viewer)
      ? `/members/${author.username}`
      : null;
  return {
    displayName,
    href,
    avatarUrl: restricted ? null : author.image,
  };
}

export function formatForumDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatForumDay(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(date);
}

export function canPostInForum(
  user: { status: UserStatus } | null | undefined,
): boolean {
  return user?.status === UserStatus.ACTIVE;
}

/** Drop a pagination cursor unless it matches a row that still exists. */
export function paginationCursor(
  requested: string | undefined,
  existingId: string | null | undefined,
): string | undefined {
  const id = requested?.trim();
  if (!id || !existingId || id !== existingId) return undefined;
  return existingId;
}

export const forumAuthorSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  status: true,
  parentId: true,
  isProfilePublic: true,
  image: true,
} as const;
