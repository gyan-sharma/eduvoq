import { Role, UserStatus, type User } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/server/db";

export async function requireSession(): Promise<User> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  if (
    user.status === UserStatus.BANNED ||
    user.status === UserStatus.SUSPENDED ||
    user.status === UserStatus.PENDING_VERIFICATION
  ) {
    throw new Error("FORBIDDEN");
  }
  const jwtVersion = session.user.tokenVersion ?? 0;
  if (jwtVersion !== user.tokenVersion) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireActiveUser(): Promise<User> {
  const user = await requireSession();
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireActiveUser();
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Parents, educators, experts, and staff may book; students may not. */
export async function requireBooker(): Promise<User> {
  const user = await requireActiveUser();
  if (user.role === Role.STUDENT) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function revokeSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
