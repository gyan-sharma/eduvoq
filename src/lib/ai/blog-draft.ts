import { stripStudentPii } from "@/lib/ai/privacy";

export type BlogDraftFields = {
  title: string;
  excerpt: string;
  body: string;
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function clip(value: string, max: number): string {
  const trimmed = stripStudentPii(value).trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd();
}

function fallbackDraft(text: string): BlogDraftFields {
  const cleaned = stripStudentPii(text).trim();
  const [first = "Untitled draft", ...rest] = cleaned.split(/\n+/);
  const title = clip(first.replace(/^#+\s*/, ""), 255) || "Untitled draft";
  const body = clip(rest.join("\n\n") || cleaned, 20000);
  const excerptSource = body.replace(/\s+/g, " ");
  const excerpt =
    excerptSource.length <= 280
      ? excerptSource
      : `${excerptSource.slice(0, 277).trimEnd()}…`;
  return { title, excerpt, body };
}

export function parseBlogDraft(text: string): BlogDraftFields {
  const json = extractJsonObject(text);
  const title = typeof json?.title === "string" ? json.title : "";
  const body = typeof json?.body === "string" ? json.body : "";
  if (title.trim().length >= 8 && body.trim().length >= 40) {
    const excerpt =
      typeof json?.excerpt === "string" ? json.excerpt : "";
    const parsed: BlogDraftFields = {
      title: clip(title, 255),
      excerpt: clip(excerpt, 2000),
      body: clip(body, 20000),
    };
    if (!parsed.excerpt) {
      const compact = parsed.body.replace(/\s+/g, " ");
      parsed.excerpt =
        compact.length <= 280
          ? compact
          : `${compact.slice(0, 277).trimEnd()}…`;
    }
    return parsed;
  }
  return fallbackDraft(text);
}
