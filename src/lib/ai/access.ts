import { Role, UserStatus } from "@prisma/client";

import { EDUCATOR_LIBRARY_ROLES } from "@/lib/entitlements";
import { isStudentActor, type AiActor } from "@/lib/ai/privacy";

export function canUseLessonPlanAssistant(
  user: AiActor | null | undefined,
): boolean {
  if (!user) return false;
  if (user.status !== UserStatus.ACTIVE) return false;
  if (isStudentActor(user)) return false;
  return EDUCATOR_LIBRARY_ROLES.includes(user.role);
}

export function canUseBlogDraftHelper(
  user: AiActor | null | undefined,
): boolean {
  if (!user) return false;
  if (user.status !== UserStatus.ACTIVE) return false;
  if (user.role === Role.STUDENT) return false;
  return true;
}
