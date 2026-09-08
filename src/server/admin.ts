import { Role, type User } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/server/rbac";

export async function requireStaff(): Promise<User> {
  return requireRole(Role.STAFF, Role.ADMIN);
}

export async function requireAdmin(): Promise<User> {
  return requireRole(Role.ADMIN);
}

export async function requireStaffPage(): Promise<User> {
  try {
    return await requireStaff();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login?callbackUrl=/admin");
    }
    redirect("/");
  }
}

export function isNextNavigationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}

export function adminActionError(error: unknown): { error: string } | null {
  if (isNextNavigationError(error)) return null;
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return { error: "Please log in." };
    }
    if (error.message === "FORBIDDEN") {
      return { error: "You do not have access to this action." };
    }
  }
  return null;
}

export type AdminActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;
