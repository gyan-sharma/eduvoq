import { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/server/db";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: input.meta,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "audit write failed");
  }
}
