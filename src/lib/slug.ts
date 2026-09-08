export const RESERVED_POST_SLUGS = new Set([
  "submit",
  "categories",
  "tags",
  "feed",
  "rss",
]);

export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "post";
}

export function uniqueCandidate(base: string, n: number, maxLength = 191): string {
  if (n <= 1) return base.slice(0, maxLength);
  const suffix = `-${n}`;
  return `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}
