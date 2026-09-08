/** TipTap-shaped JSON stored in Prisma Json columns. Render as text only. */

export type TipTapText = { type: "text"; text: string };
export type TipTapParagraph = {
  type: "paragraph";
  content?: TipTapText[];
};
export type TipTapDoc = {
  type: "doc";
  content: TipTapParagraph[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Wrap plain input as a TipTap doc. Never stores HTML. */
export function toDoc(plain: string): TipTapDoc {
  const normalized = plain.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const chunks = normalized.split(/\n{2,}/);
  return {
    type: "doc",
    content: chunks.map((chunk) => ({
      type: "paragraph",
      content: [{ type: "text", text: chunk.trimEnd() }],
    })),
  };
}

/** Extract visible text from TipTap JSON. Ignores unknown node types. */
export function collectText(value: unknown): string {
  if (Array.isArray(value)) return value.map(collectText).join("");
  if (!isRecord(value)) return "";
  if (value.type === "text" && typeof value.text === "string") return value.text;
  if ("content" in value) return collectText(value.content);
  return "";
}

export function paragraphsFromDoc(value: unknown): string[] {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) {
    const fallback = collectText(value).trim();
    return fallback ? [fallback] : [];
  }
  return value.content
    .map((node) => collectText(node).trim())
    .filter((text) => text.length > 0);
}

export function excerptFromDoc(value: unknown, max = 180): string {
  const text = paragraphsFromDoc(value).join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
