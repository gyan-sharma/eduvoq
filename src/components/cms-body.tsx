import type { ReactNode } from "react";
import Link from "next/link";

type TipTapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
};

function isNode(value: unknown): value is TipTapNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function textOf(node: TipTapNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(textOf).join("");
}

function wrapMarks(text: string, marks: TipTapMark[] | undefined): ReactNode {
  let node: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") {
      node = <strong>{node}</strong>;
    } else if (mark.type === "italic") {
      node = <em>{node}</em>;
    } else if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "");
      if (!href) continue;
      if (href.startsWith("/") || href.startsWith("mailto:")) {
        node = (
          <Link href={href} className="font-medium text-primary hover:underline">
            {node}
          </Link>
        );
      } else {
        node = (
          <a
            href={href}
            className="font-medium text-primary hover:underline"
            rel="noreferrer"
          >
            {node}
          </a>
        );
      }
    }
  }
  return node;
}

function renderNodes(nodes: TipTapNode[] | undefined): ReactNode {
  return nodes?.map((node, index) => (
    <NodeView key={`${node.type}-${index}`} node={node} />
  ));
}

function NodeView({ node }: { node: TipTapNode }) {
  switch (node.type) {
    case "doc":
      return <>{renderNodes(node.content)}</>;
    case "heading": {
      const level = Number(node.attrs?.level) === 3 ? 3 : 2;
      const Tag = level === 3 ? "h3" : "h2";
      const id =
        typeof node.attrs?.id === "string"
          ? node.attrs.id
          : undefined;
      return (
        <Tag
          id={id}
          className="mt-10 scroll-mt-24 font-heading text-2xl font-semibold tracking-tight first:mt-0"
        >
          {textOf(node)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="mt-4 text-base leading-7 text-foreground/90">
          {node.content?.map((child, index) => (
            <NodeView key={index} node={child} />
          ))}
        </p>
      );
    case "bulletList":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-7 [&_p]:mt-0">
          {renderNodes(node.content)}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-7 [&_p]:mt-0">
          {renderNodes(node.content)}
        </ol>
      );
    case "listItem":
      return <li>{renderNodes(node.content)}</li>;
    case "hardBreak":
      return <br />;
    case "text":
      return wrapMarks(node.text ?? "", node.marks);
    default:
      return <>{renderNodes(node.content)}</>;
  }
}

export function CmsBody({ body }: { body: unknown }) {
  if (!isNode(body)) {
    return null;
  }
  return <div className="max-w-none">{renderNodes(body.content)}</div>;
}
