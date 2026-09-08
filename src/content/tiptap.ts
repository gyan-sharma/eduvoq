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
