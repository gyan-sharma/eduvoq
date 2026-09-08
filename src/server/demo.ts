import { FLAG_DEMO_MODE } from "@/lib/flags";
import { isFlagEnabled } from "@/server/flags";

export async function isDemoMode(): Promise<boolean> {
  return isFlagEnabled(FLAG_DEMO_MODE);
}
