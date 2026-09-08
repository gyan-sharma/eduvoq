export type TipTapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
};

export function doc(...content: TipTapNode[]): TipTapNode {
  return { type: "doc", content };
}

export function heading(
  level: 2 | 3,
  text: string,
  id?: string,
): TipTapNode {
  return {
    type: "heading",
    attrs: id ? { level, id } : { level },
    content: [{ type: "text", text }],
  };
}

export function paragraph(
  ...parts: Array<string | TipTapNode>
): TipTapNode {
  return {
    type: "paragraph",
    content: parts.map((part) =>
      typeof part === "string" ? { type: "text", text: part } : part,
    ),
  };
}

export function link(text: string, href: string): TipTapNode {
  return {
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href } }],
  };
}

export function bulletList(...items: Array<string | TipTapNode[]>): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [
        Array.isArray(item) ? paragraph(...item) : paragraph(item),
      ],
    })),
  };
}

function isNode(value: unknown): value is TipTapNode {
  return typeof value === "object" && value !== null && "type" in value;
}

export function textFromTipTap(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!isNode(value)) return "";
  if (value.text) return value.text;
  const joined = (value.content ?? []).map(textFromTipTap).join(
    value.type === "paragraph" || value.type === "heading" || value.type === "listItem"
      ? "\n"
      : "",
  );
  return joined.replace(/\n{3,}/g, "\n\n").trim();
}

export function plainTextToDoc(body: string): TipTapNode {
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length === 0) {
    return doc(paragraph(""));
  }
  return doc(
    ...blocks.map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length <= 1) return paragraph(block);
      const parts: Array<string | TipTapNode> = [];
      lines.forEach((line, index) => {
        if (index > 0) parts.push({ type: "hardBreak" });
        parts.push(line);
      });
      return paragraph(...parts);
    }),
  );
}
