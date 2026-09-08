export const XAI_DEFAULT_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = "grok-4.5";

export type XaiConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Read xAI settings. Empty `apiKey` means the optional module is inert. */
export function getXaiConfig(): XaiConfig {
  return {
    apiKey: trimEnv(process.env.XAI_API_KEY),
    baseURL: (trimEnv(process.env.XAI_BASE_URL) || XAI_DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    ),
    model: trimEnv(process.env.XAI_MODEL) || XAI_DEFAULT_MODEL,
  };
}

export function isXaiConfigured(): boolean {
  return getXaiConfig().apiKey.length > 0;
}
