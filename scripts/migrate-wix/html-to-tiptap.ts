import * as cheerio from "cheerio";

import {
  doc,
  paragraph,
  type TipTapMark,
  type TipTapNode,
} from "../../src/content/tiptap";
import { canonicalWixMediaUrl, rewriteWixHref } from "./wix-urls";

type CheerioNode = {
  type: string;
  tagName?: string;
  data?: string;
};

type TagNode = CheerioNode & { type: "tag"; tagName: string };

const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "button",
  "svg",
  "path",
  "nav",
]);

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "blockquote",
  "figure",
  "pre",
]);

function isElement(node: CheerioNode): node is TagNode {
  return node.type === "tag" && typeof node.tagName === "string";
}

function textNode(text: string, marks: TipTapMark[]): TipTapNode {
  const node: TipTapNode = { type: "text", text };
  if (marks.length > 0) node.marks = marks;
  return node;
}

function stripFormat(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s*\n\s*/g, " ");
}

function isWordChar(ch: string | undefined): boolean {
  return Boolean(ch && /[\p{L}\p{N}]/u.test(ch));
}

function needsWordSpace(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  const leftEnd = left.at(-1) ?? "";
  const rightStart = right[0] ?? "";
  if (/[-'’/]$/.test(leftEnd) || /^[-'’/]/.test(rightStart)) return false;
  if (/[([{“"']$/.test(leftEnd)) return false;
  if (/[)\]}.,!?;:”"'%]/.test(rightStart) && !isWordChar(rightStart)) return false;
  return (
    isWordChar(rightStart) &&
    (isWordChar(leftEnd) || /[.,!?;:)]$/.test(leftEnd))
  );
}

function sameMarks(a: TipTapMark[] | undefined, b: TipTapMark[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function normalizeInline(nodes: TipTapNode[]): TipTapNode[] {
  const out: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const text = stripFormat(node.text ?? "");
      if (!text) continue;
      node.text = text;
    }
    const prev = out[out.length - 1];
    if (prev?.type === "text" && node.type === "text") {
      const left = prev.text ?? "";
      const right = node.text ?? "";
      if (sameMarks(prev.marks, node.marks)) {
        prev.text = needsWordSpace(left, right) ? `${left} ${right}` : `${left}${right}`;
        continue;
      }
      if (needsWordSpace(left, right)) {
        node.text = ` ${right}`;
      }
    }
    out.push(node);
  }
  return out;
}

function isEmptyInline(nodes: TipTapNode[]): boolean {
  return normalizeInline(nodes).every(
    (node) =>
      (node.type === "text" && !node.text?.trim()) ||
      node.type === "hardBreak",
  );
}

function convertInline(
  $: cheerio.CheerioAPI,
  node: CheerioNode,
  marks: TipTapMark[] = [],
): TipTapNode[] {
  if (node.type === "text") {
    const text = stripFormat(node.data ?? "");
    if (!text) return [];
    if (!text.trim()) return marks.length === 0 ? [] : [textNode(" ", marks)];
    return [textNode(text, marks)];
  }
  if (!isElement(node)) return [];
  const tag = node.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return [];
  if (tag === "br") return [{ type: "hardBreak" }];
  if (tag === "img" || tag === "wow-image") return [];

  const extra: TipTapMark[] = [];
  if (tag === "strong" || tag === "b") extra.push({ type: "bold" });
  if (tag === "em" || tag === "i") extra.push({ type: "italic" });
  if (tag === "a") {
    const href = rewriteWixHref($(node as never).attr("href") ?? "");
    if (href) extra.push({ type: "link", attrs: { href } });
  }

  const nextMarks = [...marks, ...extra];
  const out: TipTapNode[] = [];
  $(node as never)
    .contents()
    .each((_i: number, child: unknown) => {
      out.push(...convertInline($, child as CheerioNode, nextMarks));
    });
  return normalizeInline(out);
}

function imageNode($: cheerio.CheerioAPI, el: TagNode): TipTapNode | null {
  const $el = $(el as never);
  const pin = $el.find("[data-pin-media]").attr("data-pin-media");
  const src =
    pin ||
    $el.find("img").attr("src") ||
    $el.attr("src") ||
    "";
  const info = $el.attr("data-image-info") || $el.find("[data-image-info]").attr("data-image-info");
  let uri = "";
  if (info) {
    try {
      const parsed = JSON.parse(info) as {
        imageData?: { uri?: string };
        uri?: string;
      };
      uri = parsed.imageData?.uri || parsed.uri || "";
    } catch {
      uri = "";
    }
  }
  const wowId = $el.closest("wow-image").attr("id") || $el.attr("id") || "";
  const raw = src || uri || wowId;
  if (!raw) return null;
  const alt =
    $el.find("img").attr("alt") ||
    $el.attr("alt") ||
    "";
  return {
    type: "image",
    attrs: {
      src: canonicalWixMediaUrl(raw),
      alt,
    },
  };
}

function convertList(
  $: cheerio.CheerioAPI,
  el: TagNode,
  type: "bulletList" | "orderedList",
): TipTapNode {
  const items: TipTapNode[] = [];
  $(el as never)
    .children("li")
    .each((_i: number, li: unknown) => {
      const node = li as CheerioNode;
      if (!isElement(node)) return;
      const content = convertBlocks($, node);
      const safe =
        content.length > 0
          ? content
          : [paragraph(...convertInline($, node))];
      items.push({
        type: "listItem",
        content: safe.every((item) => item.type === "paragraph" || item.type === "bulletList" || item.type === "orderedList")
          ? safe
          : [paragraph(""), ...safe],
      });
    });
  return { type, content: items };
}

function headingLevel(tag: string): 2 | 3 {
  if (tag === "h1" || tag === "h2") return 2;
  return 3;
}

function convertBlocks($: cheerio.CheerioAPI, root: CheerioNode): TipTapNode[] {
  if (!isElement(root) && root.type !== "root") {
    return [];
  }
  const out: TipTapNode[] = [];
  $(root as never)
    .contents()
    .each((_i: number, raw: unknown) => {
      const child = raw as CheerioNode;
      if (child.type === "text") {
        const text = stripFormat(child.data ?? "").trim();
        if (text) out.push(paragraph(text));
        return;
      }
      if (!isElement(child)) return;
      const tag = child.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return;

      if (tag === "p") {
        const images = collectImages($, child);
        const inline = normalizeInline(convertInline($, child));
        if (!isEmptyInline(inline)) out.push({ type: "paragraph", content: inline });
        out.push(...images);
        return;
      }
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
        const inline = normalizeInline(convertInline($, child));
        if (isEmptyInline(inline)) return;
        out.push({
          type: "heading",
          attrs: { level: headingLevel(tag) },
          content: inline,
        });
        return;
      }
      if (tag === "ul") {
        out.push(convertList($, child, "bulletList"));
        return;
      }
      if (tag === "ol") {
        out.push(convertList($, child, "orderedList"));
        return;
      }
      if (tag === "blockquote") {
        const inner = convertBlocks($, child);
        out.push({
          type: "blockquote",
          content: inner.length > 0 ? inner : [paragraph(...convertInline($, child))],
        });
        return;
      }
      if (tag === "figure" || tag === "img" || tag === "wow-image") {
        const image = imageNode($, child);
        if (image) out.push(image);
        return;
      }
      if (tag === "br") {
        return;
      }
      if (BLOCK_TAGS.has(tag) || tag === "div" || tag === "section" || tag === "article" || tag === "span" || tag === "li") {
        out.push(...convertBlocks($, child));
        return;
      }
      const inline = convertInline($, child);
      if (!isEmptyInline(inline)) out.push({ type: "paragraph", content: inline });
    });
  return collapseEmpty(out);
}

function collectImages($: cheerio.CheerioAPI, root: TagNode): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  $(root as never)
    .find("wow-image, figure[data-hook='figure-IMAGE'], img")
    .each((_i: number, el: unknown) => {
      const node = el as CheerioNode;
      if (!isElement(node)) return;
      const image = imageNode($, node);
      if (image) nodes.push(image);
    });
  return nodes;
}

function collapseEmpty(nodes: TipTapNode[]): TipTapNode[] {
  return nodes.filter((node) => {
    if (node.type === "paragraph") {
      return !isEmptyInline(node.content ?? []);
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      return (node.content ?? []).length > 0;
    }
    if (node.type === "heading") {
      return !isEmptyInline(node.content ?? []);
    }
    return true;
  });
}

export function fragmentToDoc(html: string): TipTapNode {
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  const root = $("#__root").get(0) as CheerioNode | undefined;
  const blocks = root ? convertBlocks($, root) : [];
  return doc(...(blocks.length > 0 ? blocks : [paragraph("")]));
}

export function selectionToDoc(
  $: cheerio.CheerioAPI,
  selection: { each: (fn: (i: number, el: unknown) => void) => unknown },
): TipTapNode {
  const blocks: TipTapNode[] = [];
  selection.each((_, el) => {
    blocks.push(...convertBlocks($, el as CheerioNode));
  });
  return doc(...(blocks.length > 0 ? blocks : [paragraph("")]));
}

export function loadHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}
