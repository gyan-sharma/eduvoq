export {
  plainTextToDoc,
  textFromTipTap,
} from "@/content/tiptap";

export function jsonPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    return value.map(jsonPlainText).filter(Boolean).join("\n");
  }
  const node = value as { text?: unknown; content?: unknown };
  if (typeof node.text === "string") return node.text;
  if (node.content !== undefined) return jsonPlainText(node.content);
  return "";
}
