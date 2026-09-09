import { Board, Role, UserStatus } from "@prisma/client";

/** Roles listed on the public /members directory. STUDENT and PARENT are omitted. */
export const DIRECTORY_ROLES = [
  Role.EDUCATOR,
  Role.EXPERT,
  Role.STAFF,
  Role.ADMIN,
] as const;

export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

export const USERNAME_CHANGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const STUDENT_GRADES = [
  "Pre-primary",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
] as const;

export const BOARD_LABELS: Record<Board, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  IB: "IB",
  STATE_BOARD: "State board",
  KVS: "Kendriya Vidyalaya",
  NVS: "Navodaya Vidyalaya",
  OTHER: "Other",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  EDUCATOR: "Educator",
  EXPERT: "Expert",
  STUDENT: "Student",
  PARENT: "Parent",
};

export type FollowActor = {
  id: string;
  role: Role;
  status: UserStatus;
  parentId: string | null;
};

export type FollowTarget = {
  id: string;
  role: Role;
  status: UserStatus;
  parentId: string | null;
  isProfilePublic: boolean;
};

export type ProfileViewer = {
  id: string;
  role: Role;
  parentId: string | null;
} | null;

export function isDirectoryRole(role: Role): role is DirectoryRole {
  return (DIRECTORY_ROLES as readonly Role[]).includes(role);
}

export function directoryWhere() {
  return {
    status: UserStatus.ACTIVE,
    role: { in: [...DIRECTORY_ROLES] },
    username: { not: null },
    isProfilePublic: true,
  };
}

/** Opted-in student cards: first name + grade only. */
export function studentDirectoryWhere() {
  return {
    status: UserStatus.ACTIVE,
    role: Role.STUDENT,
    username: { not: null },
    isProfilePublic: true,
  };
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

export function firstName(name: string | null | undefined): string {
  const token = name?.trim().split(/\s+/).filter(Boolean)[0];
  return token || "Student";
}

export function replaceFirstName(
  fullName: string | null | undefined,
  nextFirst: string,
): string {
  const first = nextFirst.trim();
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return first;
  return [first, ...parts.slice(1)].join(" ");
}

export function studentGrade(classesTaught: unknown): string | null {
  const [grade] = asStringArray(classesTaught);
  return grade ?? null;
}

export function usernameChangeLockedAt(user: {
  usernameChangedAt: Date | null;
  createdAt: Date;
}): Date {
  return user.usernameChangedAt ?? user.createdAt;
}

export function isUsernameChangeLocked(
  user: { usernameChangedAt: Date | null; createdAt: Date },
  now = new Date(),
): boolean {
  return (
    now.getTime() - usernameChangeLockedAt(user).getTime() >=
    USERNAME_CHANGE_WINDOW_MS
  );
}

export function canViewProfile(
  target: FollowTarget,
  viewer: ProfileViewer,
): boolean {
  if (viewer?.id === target.id) return true;
  if (target.role === Role.STUDENT && viewer?.id === target.parentId) {
    return true;
  }
  if (target.status !== UserStatus.ACTIVE) return false;
  return target.isProfilePublic;
}

/** Public visitors (and non-parent adults) see first-name + grade only. */
export function isStudentPublicCard(
  target: { id: string; role: Role; parentId: string | null },
  viewer: ProfileViewer,
): boolean {
  if (target.role !== Role.STUDENT) return false;
  if (viewer?.id === target.id) return false;
  if (viewer?.id === target.parentId) return false;
  return true;
}

export function canFollowUser(
  actor: FollowActor,
  target: FollowTarget,
): { ok: true } | { ok: false; reason: string } {
  if (actor.id === target.id) {
    return { ok: false, reason: "You cannot follow yourself." };
  }
  if (actor.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "Finish activating your account first." };
  }
  if (target.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "That member is not available." };
  }

  if (actor.role === Role.STUDENT) {
    const isOwnParent = Boolean(actor.parentId) && target.id === actor.parentId;
    const isPublicStudent =
      target.role === Role.STUDENT && target.isProfilePublic;
    if (!isOwnParent && !isPublicStudent) {
      return { ok: false, reason: "Students cannot follow arbitrary adults." };
    }
    // Own parent is allowed even when the parent profile is hidden / unlisted.
    if (isOwnParent) return { ok: true };
  }

  if (target.role === Role.STUDENT) {
    const isParent = actor.id === target.parentId;
    if (!isParent && !target.isProfilePublic) {
      return { ok: false, reason: "That member is not available." };
    }
  } else if (!target.isProfilePublic) {
    return { ok: false, reason: "That member is not available." };
  }

  return { ok: true };
}

/** Students cannot self-serve a public card; only a parent may opt them in. */
export function canSetOwnProfilePublic(role: Role): boolean {
  return role !== Role.STUDENT;
}

/**
 * Link on a FOLLOW notification. Omit when the recipient cannot view the
 * actor's profile so a hidden student username is not published.
 */
export function followNotificationHref(
  actor: FollowTarget & { username: string | null },
  recipient: ProfileViewer,
): string | null {
  if (!actor.username) return null;
  if (!canViewProfile(actor, recipient)) return null;
  return `/members/${actor.username}`;
}

export type PublicMemberCard = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  headline: string | null;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  boardAffiliation: Board | null;
  schoolName: string | null;
  bio: string | null;
  subjects: string[];
  classesTaught: string[];
  linkedinUrl: string | null;
  restricted: boolean;
};

export function toPublicMemberCard(
  user: {
    id: string;
    username: string | null;
    name: string | null;
    role: Role;
    headline: string | null;
    image: string | null;
    city: string | null;
    state: string | null;
    boardAffiliation: Board | null;
    schoolName: string | null;
    bio: string | null;
    subjects: unknown;
    classesTaught: unknown;
    linkedinUrl: string | null;
    parentId: string | null;
  },
  viewer: ProfileViewer,
): PublicMemberCard | null {
  if (!user.username) return null;
  const restricted = isStudentPublicCard(user, viewer);
  if (restricted) {
    const grade = studentGrade(user.classesTaught);
    return {
      id: user.id,
      username: user.username,
      displayName: firstName(user.name),
      role: Role.STUDENT,
      headline: grade,
      avatarUrl: null,
      city: null,
      state: null,
      boardAffiliation: null,
      schoolName: null,
      bio: null,
      subjects: [],
      classesTaught: grade ? [grade] : [],
      linkedinUrl: null,
      restricted: true,
    };
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.name?.trim() || user.username,
    role: user.role,
    headline: user.headline,
    avatarUrl: user.role === Role.STUDENT ? null : user.image,
    city: user.city,
    state: user.state,
    boardAffiliation: user.boardAffiliation,
    schoolName: user.schoolName,
    bio: user.bio,
    subjects: asStringArray(user.subjects),
    classesTaught: asStringArray(user.classesTaught),
    linkedinUrl: user.linkedinUrl,
    restricted: false,
  };
}
