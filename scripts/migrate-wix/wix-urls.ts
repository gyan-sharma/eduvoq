import redirectsFile from "../../redirects.json";
import { slugify } from "../../src/lib/slug";

const WIX_HOSTS = new Set([
  "eduvoq.wixsite.com",
  "www.eduvoq.wixsite.com",
]);

type RedirectRow = {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
};

const REDIRECT_ROWS: RedirectRow[] = Array.isArray(redirectsFile)
  ? redirectsFile
  : ((redirectsFile as { redirects?: RedirectRow[] }).redirects ?? []);

const REDIRECTS = REDIRECT_ROWS.slice().sort(
  (a, b) => b.source.length - a.source.length,
);

function stripSitePrefix(pathname: string): string {
  if (pathname === "/chalknpencil") return "/";
  if (pathname.startsWith("/chalknpencil/")) {
    return pathname.slice("/chalknpencil".length);
  }
  return pathname;
}

function applyRedirect(pathname: string): string {
  const cleaned = stripSitePrefix(pathname) || "/";
  for (const row of REDIRECTS) {
    const mapped = matchPattern(row.source, cleaned, row.destination);
    if (mapped) return mapped;
  }
  return cleaned;
}

function matchPattern(
  source: string,
  pathname: string,
  destination: string,
): string | null {
  if (source === pathname) return destination;
  const sourceParts = source.split("/");
  const pathParts = pathname.split("/");
  if (sourceParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < sourceParts.length; i += 1) {
    const token = sourceParts[i];
    if (token.startsWith(":")) {
      if (!pathParts[i]) return null;
      params[token.slice(1)] = pathParts[i];
      continue;
    }
    if (token !== pathParts[i]) return null;
  }
  return destination.replace(/:([A-Za-z_]+)/g, (_, key: string) => params[key] ?? "");
}

/** Map a Wix href onto the rebuilt site path when possible. */
export function rewriteWixHref(href: string | undefined | null): string {
  if (!href) return "";
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
    return trimmed;
  }
  if (trimmed.startsWith("#")) return trimmed;

  try {
    const base = "https://eduvoq.wixsite.com";
    const url = new URL(trimmed, `${base}/chalknpencil/`);
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (WIX_HOSTS.has(url.hostname)) {
        const next = rewriteHashtagPath(applyRedirect(url.pathname));
        return `${next}${url.search}${url.hash}`;
      }
      return url.toString();
    }
  } catch {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return rewriteHashtagPath(
      applyRedirect(trimmed.split(/[?#]/, 1)[0] ?? trimmed),
    );
  }
  return trimmed;
}

/** Wix in-body hashtags are /blog/hashtags/CamelCase; the app lists /blog/tags/:slug. */
export function slugifyHashtag(raw: string): string {
  const spaced = decodeURIComponent(raw)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2");
  return slugify(spaced);
}

function rewriteHashtagPath(pathname: string): string {
  const match = pathname.match(/^\/blog\/(?:hashtags|tags)\/([^/]+)\/?$/);
  if (!match) return pathname;
  return `/blog/tags/${slugifyHashtag(match[1])}`;
}

/** Map a Wix CDN URL onto a copied `/wix/...` file when the media index has it. */
export function localWixMediaPath(
  url: string,
  index: Record<string, string>,
): string | null {
  const canonical = canonicalWixMediaUrl(url);
  const match = canonical.match(/static\.wixstatic\.com\/media\/([^/?#]+)/i);
  if (!match) return null;
  const folder = decodeURIComponent(match[1]);
  return (
    index[folder] ??
    index[folder.replaceAll("~", "_")] ??
    index[folder.replaceAll("_mv2", "~mv2")] ??
    null
  );
}

export function rewriteTipTapLocalMedia(
  node: {
    type: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
    text?: string;
    marks?: unknown[];
  },
  index: Record<string, string>,
): typeof node {
  const next = { ...node };
  if (node.type === "image" && node.attrs?.src) {
    const local = localWixMediaPath(String(node.attrs.src), index);
    next.attrs = { ...node.attrs, src: local ?? node.attrs.src };
  }
  if (Array.isArray(node.content)) {
    next.content = node.content.map((child) =>
      rewriteTipTapLocalMedia(
        child as typeof node,
        index,
      ),
    );
  }
  return next;
}

export function canonicalWixMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const media = trimmed.match(
    /^(https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+)/i,
  );
  if (media) return media[1];
  if (!trimmed.startsWith("http") && !trimmed.startsWith("/")) {
    return `https://static.wixstatic.com/media/${trimmed.replace(/^\/+/, "")}`;
  }
  return trimmed;
}

export function wixPostUrl(slug: string): string {
  return `https://eduvoq.wixsite.com/chalknpencil/post/${slug}`;
}

export function humanizeSlug(slug: string): string {
  const special: Record<string, string> = {
    cbse: "CBSE",
    icse: "ICSE",
    ib: "IB",
    "nep-2020": "NEP 2020",
    "international-baccalaureate-ib": "International Baccalaureate (IB)",
    "kendriya-vidyalaya": "Kendriya Vidyalaya",
    "municipal-school": "Municipal School",
    edtech: "EdTech",
    "ai-tools-for-teachers": "AI tools for Teachers",
  };
  if (special[slug]) return special[slug];
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function cleanTagName(name: string, slug: string): string {
  const trimmed = name.replace(/^["“”']+|["“”']+$/g, "").trim();
  return trimmed || humanizeSlug(slug);
}
