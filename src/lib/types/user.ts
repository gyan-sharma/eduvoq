import type { Board, Role, UserStatus } from "@prisma/client";

export type { Role, UserStatus };

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  avatarUrl: string | null;
  headline: string | null;
  boardAffiliation: string | null;
  createdAt: string;
}

export interface Profile extends UserPublic {
  bio: string | null;
  schoolName: string | null;
  city: string | null;
  state: string | null;
  subjects: string[];
  classesTaught: string[];
  linkedinUrl: string | null;
  isPublic: boolean;
}

export type ProfileFormUser = {
  name: string | null;
  username: string | null;
  headline: string | null;
  bio: string | null;
  schoolName: string | null;
  city: string | null;
  state: string | null;
  boardAffiliation: Board | null;
  subjects: unknown;
  classesTaught: unknown;
  linkedinUrl: string | null;
  isProfilePublic: boolean;
  usernameChangedAt: Date | null;
  createdAt: Date;
};

export function toProfileFormUser(user: ProfileFormUser): ProfileFormUser {
  return {
    name: user.name,
    username: user.username,
    headline: user.headline,
    bio: user.bio,
    schoolName: user.schoolName,
    city: user.city,
    state: user.state,
    boardAffiliation: user.boardAffiliation,
    subjects: user.subjects,
    classesTaught: user.classesTaught,
    linkedinUrl: user.linkedinUrl,
    isProfilePublic: user.isProfilePublic,
    usernameChangedAt: user.usernameChangedAt,
    createdAt: user.createdAt,
  };
}

export interface SessionUser {
  id: string;
  role: Role;
  status: UserStatus;
  tokenVersion: number;
  email: string;
  username: string | null;
  emailVerified: Date | null;
  dateOfBirth: string | null;
  parentId: string | null;
}
