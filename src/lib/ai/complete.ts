import { getXaiClient } from "@/lib/ai/client";
import { getXaiConfig } from "@/lib/ai/config";
import {
  type AiFeature,
  logAiCompletion,
  logAiFailure,
} from "@/lib/ai/log";
import { privacyBlockReason, stripStudentPii } from "@/lib/ai/privacy";

const GENERIC_PROVIDER_ERROR =
  "Could not reach the assistant. Try again later.";

export type AiCompleteResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function providerErrorInfo(err: unknown): { status?: number; code?: string } {
  if (err && typeof err === "object") {
    const e = err as { status?: number; code?: string };
    return { status: e.status, code: e.code };
  }
  return {};
}

export async function completeAiText(args: {
  system: string;
  user: string;
  userId: string;
  feature: AiFeature;
  maxTokens?: number;
}): Promise<AiCompleteResult> {
  const blocked = privacyBlockReason(args.user);
  if (blocked) return { ok: false, error: blocked };

  // Defense in depth: never send residual identifiers even if the gate missed.
  const prompt = stripStudentPii(args.user);
  const client = getXaiClient();
  const config = getXaiConfig();
  if (!client || !config.apiKey) {
    return { ok: false, error: "AI assistants are not configured." };
  }

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: args.maxTokens ?? 2500,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      return { ok: false, error: "The assistant returned an empty draft." };
    }
    const text = stripStudentPii(raw);
    logAiCompletion({
      feature: args.feature,
      userId: args.userId,
      model: config.model,
      promptChars: prompt.length,
      completionChars: text.length,
    });
    return { ok: true, text };
  } catch (err) {
    const info = providerErrorInfo(err);
    logAiFailure({
      feature: args.feature,
      userId: args.userId,
      status: info.status,
      code: info.code,
    });
    return { ok: false, error: GENERIC_PROVIDER_ERROR };
  }
}
