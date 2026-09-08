import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { textFromTipTap } from "../../src/content/tiptap";
import {
  defaultArchiveRoot,
  findPageHtml,
  listRenderedPostFiles,
  migrationDir,
  missingArchiveMessage,
  readSitemap,
  resolveArchiveRoot,
  slugFromPostFilename,
  type SitemapUrl,
} from "./archive";
import { fragmentToDoc, loadHtml, selectionToDoc } from "./html-to-tiptap";
import type { ExtractedPost, ExtractedPostsFile, ExtractedTag } from "./types";
import {
  canonicalWixMediaUrl,
  cleanTagName,
  humanizeSlug,
  wixPostUrl,
} from "./wix-urls";

const EXPECTED_POST_COUNT = 68;

function metaContent(
  $: ReturnType<typeof loadHtml>,
  key: string,
): string {
  return (
    $(`meta[property="${key}"]`).attr("content") ||
    $(`meta[name="${key}"]`).attr("content") ||
    ""
  ).trim();
}

function parseJsonLd($: ReturnType<typeof loadHtml>): Record<string, unknown> | null {
  const raw = $('script[type="application/ld+json"]').first().text().trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function truncate(text: string, max = 320): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function isoDate(value: string | undefined, fallback?: string): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`).toISOString();
    }
  }
  if (fallback) return isoDate(fallback);
  return new Date("2024-01-01T00:00:00.000Z").toISOString();
}

function emagazineSlugs(archiveRoot: string): Set<string> {
  const file = findPageHtml(archiveRoot, "blog/categories/e-magazine");
  if (!file) return new Set();
  const html = readFileSync(file, "utf8");
  return new Set(
    [...html.matchAll(/\/post\/([a-z0-9-]+)/gi)].map((match) => match[1]),
  );
}

function sitemapEntries(archiveRoot: string): Map<string, SitemapUrl> {
  const map = new Map<string, SitemapUrl>();
  for (const row of readSitemap(archiveRoot, "blog-posts-sitemap.xml")) {
    const slug = row.loc.split("/post/").pop()?.replace(/\/+$/, "");
    if (slug) map.set(slug, row);
  }
  return map;
}

function listSlugs(archiveRoot: string): string[] {
  const fromSitemap = [...sitemapEntries(archiveRoot).keys()];
  if (fromSitemap.length > 0) return fromSitemap.sort();
  return listRenderedPostFiles(archiveRoot)
    .map(slugFromPostFilename)
    .sort();
}

function extractTags($: ReturnType<typeof loadHtml>): ExtractedTag[] {
  const seen = new Set<string>();
  const tags: ExtractedTag[] = [];
  $("nav[data-hook='tag-cloud-root'] a[href*='/blog/tags/']").each(
    (_i: number, el: unknown) => {
      const href = $(el as never).attr("href") ?? "";
      const slug = href.split("/blog/tags/").pop()?.split(/[?#]/)[0];
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      tags.push({
        slug,
        name: cleanTagName($(el as never).text(), slug),
      });
    },
  );
  if (tags.length === 0) {
    $("a[href*='/blog/tags/']").each((_i: number, el: unknown) => {
      const href = $(el as never).attr("href") ?? "";
      const slug = href.split("/blog/tags/").pop()?.split(/[?#]/)[0];
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      tags.push({
        slug,
        name: cleanTagName($(el as never).text() || humanizeSlug(slug), slug),
      });
    });
  }
  return tags;
}

function extractPost(
  archiveRoot: string,
  slug: string,
  sitemap: Map<string, SitemapUrl>,
  magazine: Set<string>,
): ExtractedPost {
  const sourcePath = findPageHtml(archiveRoot, `post/${slug}`);
  const warnings: string[] = [];
  if (!sourcePath) {
    warnings.push("html-missing");
    const sitemapRow = sitemap.get(slug);
    const title = humanizeSlug(slug);
    const excerpt = title;
    const bodyJson = fragmentToDoc(`<p>${title}</p>`);
    return {
      slug,
      title,
      excerpt,
      seoTitle: title,
      seoDescription: excerpt,
      kind: magazine.has(slug) ? "EMAGAZINE" : "BLOG",
      publishedAt: isoDate(sitemapRow?.lastmod),
      categorySlugs: magazine.has(slug) ? ["e-magazine"] : [],
      tagSlugs: [],
      tags: [],
      coverImageUrl: sitemapRow?.image
        ? canonicalWixMediaUrl(sitemapRow.image)
        : null,
      sourcePath: "",
      sourceUrl: wixPostUrl(slug),
      bodyJson,
      bodyText: title,
      warnings,
    };
  }

  const html = readFileSync(sourcePath, "utf8");
  const $ = loadHtml(html);
  const ld = parseJsonLd($);
  const article = $("article[data-hook='post']");
  const title =
    article.find("h1[data-hook='post-title']").first().text().trim() ||
    metaContent($, "og:title") ||
    $("title").first().text().replace(/\s*\|\s*EduVoq.*$/i, "").trim() ||
    (typeof ld?.headline === "string" ? ld.headline : "") ||
    humanizeSlug(slug);

  const sourceAuthor =
    article.find("[data-hook='user-name']").first().text().trim() ||
    metaContent($, "article:author") ||
    (typeof (ld?.author as { name?: string } | undefined)?.name === "string"
      ? (ld?.author as { name: string }).name
      : "EduVoq");

  const publishedAt = isoDate(
    metaContent($, "article:published_time") ||
      (typeof ld?.datePublished === "string" ? ld.datePublished : undefined),
    sitemap.get(slug)?.lastmod,
  );
  const updatedAt = isoDate(
    metaContent($, "article:modified_time") ||
      (typeof ld?.dateModified === "string" ? ld.dateModified : undefined),
    publishedAt,
  );

  const viewer = article.find("[data-id='content-viewer']");
  let bodyJson = viewer.length
    ? selectionToDoc($, viewer)
    : fragmentToDoc("");
  let bodyText = textFromTipTap(bodyJson);
  if (!bodyText) {
    const og = metaContent($, "og:description");
    if (og) {
      bodyJson = fragmentToDoc(`<p>${og}</p>`);
      bodyText = textFromTipTap(bodyJson);
      warnings.push("body-from-og-description");
    } else {
      warnings.push("empty-body");
    }
  }

  const excerpt = truncate(
    metaContent($, "og:description") ||
      (typeof ld?.description === "string" ? ld.description : "") ||
      bodyText,
  );
  const tags = extractTags($);
  const cover =
    metaContent($, "og:image") ||
    sitemap.get(slug)?.image ||
    "";

  return {
    slug,
    title,
    excerpt,
    seoTitle: title,
    seoDescription: excerpt,
    kind: magazine.has(slug) ? "EMAGAZINE" : "BLOG",
    publishedAt,
    updatedAt,
    sourceAuthor,
    categorySlugs: magazine.has(slug) ? ["e-magazine"] : [],
    tagSlugs: tags.map((tag) => tag.slug),
    tags,
    coverImageUrl: cover ? canonicalWixMediaUrl(cover) : null,
    sourcePath: path.relative(archiveRoot, sourcePath),
    sourceUrl: wixPostUrl(slug),
    bodyJson,
    bodyText,
    warnings,
  };
}

export function extractPosts(options?: {
  archiveRoot?: string;
  cwd?: string;
  write?: boolean;
}): ExtractedPostsFile {
  const cwd = options?.cwd ?? process.cwd();
  const archiveRoot = options?.archiveRoot ?? resolveArchiveRoot(cwd);
  if (!archiveRoot) {
    throw new Error(missingArchiveMessage(defaultArchiveRoot(cwd)));
  }

  const sitemap = sitemapEntries(archiveRoot);
  const magazine = emagazineSlugs(archiveRoot);
  const slugs = listSlugs(archiveRoot);
  const posts = slugs.map((slug) =>
    extractPost(archiveRoot, slug, sitemap, magazine),
  );

  const payload: ExtractedPostsFile = {
    generatedAt: new Date().toISOString(),
    archiveRoot,
    count: posts.length,
    posts,
  };

  if (options?.write !== false) {
    const dir = migrationDir(cwd);
    mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "posts.json");
    writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  }

  return payload;
}

export function readExtractedPosts(cwd = process.cwd()): ExtractedPostsFile | null {
  const file = path.join(migrationDir(cwd), "posts.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as ExtractedPostsFile;
}

function isMain(): boolean {
  const entry = process.argv[1]?.replaceAll("\\", "/");
  return Boolean(entry?.endsWith("extract-posts.ts"));
}

if (isMain()) {
  try {
    const result = extractPosts();
    const empty = result.posts.filter((post) =>
      post.warnings.includes("empty-body") || post.warnings.includes("html-missing"),
    );
    console.log(
      `Extracted ${result.count} posts → ${path.join(migrationDir(), "posts.json")}`,
    );
    if (result.count !== EXPECTED_POST_COUNT) {
      console.warn(
        `Expected ${EXPECTED_POST_COUNT} posts from the Wix sitemap, got ${result.count}.`,
      );
    }
    if (empty.length > 0) {
      console.warn(
        `${empty.length} post(s) had thin or missing bodies: ${empty.map((p) => p.slug).join(", ")}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
