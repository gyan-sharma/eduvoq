import OpenAI from "openai";

import { getXaiConfig } from "@/lib/ai/config";

export {
  getXaiConfig,
  isXaiConfigured,
  XAI_DEFAULT_BASE_URL,
  XAI_DEFAULT_MODEL,
} from "@/lib/ai/config";

/**
 * OpenAI-compatible client pointed at xAI. Returns `null` when `XAI_API_KEY`
 * is unset so the rest of the product can boot and serve without AI.
 */
export function getXaiClient(): OpenAI | null {
  const config = getXaiConfig();
  if (!config.apiKey) return null;
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 45_000,
    maxRetries: 1,
  });
}
