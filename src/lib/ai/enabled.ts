import { isXaiConfigured } from "@/lib/ai/config";
import { FLAG_AI_ASSISTANTS } from "@/lib/flags";
import { isFeatureEnabled } from "@/server/flags";

export type AiAvailability = {
  enabled: boolean;
  configured: boolean;
  available: boolean;
};

export async function isAiAssistantsEnabled(): Promise<boolean> {
  return isFeatureEnabled(FLAG_AI_ASSISTANTS);
}

/** Flag on AND `XAI_API_KEY` present. Core product ignores this when false. */
export async function getAiAvailability(): Promise<AiAvailability> {
  const enabled = await isAiAssistantsEnabled();
  const configured = isXaiConfigured();
  return { enabled, configured, available: enabled && configured };
}

export async function isAiAvailable(): Promise<boolean> {
  const status = await getAiAvailability();
  return status.available;
}
