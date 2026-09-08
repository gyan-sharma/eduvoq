import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";

export type AiFeature = "lesson_plan" | "blog_draft";

/** Hash user ids before they touch AI logs. Retention is 30 days at the log sink. */
export function hashAiUserId(userId: string): string {
  return createHash("sha256")
    .update(`eduvoq:ai:${userId}`)
    .digest("hex")
    .slice(0, 16);
}

export function logAiCompletion(args: {
  feature: AiFeature;
  userId: string;
  model: string;
  promptChars: number;
  completionChars: number;
}): void {
  logger.info(
    {
      event: "ai.complete",
      feature: args.feature,
      userHash: hashAiUserId(args.userId),
      model: args.model,
      promptChars: args.promptChars,
      completionChars: args.completionChars,
      retentionDays: 30,
    },
    "xAI completion",
  );
}

export function logAiFailure(args: {
  feature: AiFeature;
  userId: string;
  status?: number;
  code?: string;
}): void {
  logger.error(
    {
      event: "ai.error",
      feature: args.feature,
      userHash: hashAiUserId(args.userId),
      status: args.status,
      code: args.code,
    },
    "xAI request failed",
  );
}
