import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Default snapshot path at the repo / workspace root (gitignored). */
export const DEFAULT_ARCHIVE_DIRNAME = "chalknpencil-archive";

export function defaultArchiveRoot(cwd = process.cwd()): string {
  const fromEnv = process.env.ARCHIVE_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(cwd, DEFAULT_ARCHIVE_DIRNAME);
}

export function isArchiveRoot(root: string): boolean {
  return (
    existsSync(path.join(root, "rendered")) ||
    existsSync(path.join(root, "wget")) ||
    existsSync(path.join(root, "meta"))
  );
}

export function resolveArchiveRoot(cwd = process.cwd()): string | null {
  const root = defaultArchiveRoot(cwd);
  return isArchiveRoot(root) ? root : null;
}

export function missingArchiveMessage(root: string): string {
  return [
    `Wix archive not found at ${root}.`,
    "Place the snapshot at ./chalknpencil-archive/ (gitignored) or set ARCHIVE_ROOT to that directory.",
    "Example: ARCHIVE_ROOT=/path/to/eduvoq/chalknpencil-archive pnpm migrate:wix",
    "Do not git-add the archive itself.",
  ].join("\n");
}

export function migrationDir(cwd = process.cwd()): string {
  return path.resolve(cwd, process.env.MIGRATION_DIR?.trim() || "migration");
}

export function findPageHtml(
  archiveRoot: string,
  wixPath: string,
): string | null {
  const renderedName = `chalknpencil__${wixPath.replaceAll("/", "__")}.html`;
  const rendered = path.join(archiveRoot, "rendered", renderedName);
  if (existsSync(rendered)) return rendered;

  const wgetFile = path.join(
    archiveRoot,
    "wget",
    "eduvoq.wixsite.com",
    "chalknpencil",
    `${wixPath}.html`,
  );
  if (existsSync(wgetFile)) return wgetFile;

  const wgetIndex = path.join(
    archiveRoot,
    "wget",
    "eduvoq.wixsite.com",
    "chalknpencil",
    wixPath,
    "index.html",
  );
  if (existsSync(wgetIndex)) return wgetIndex;

  return null;
}

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  image?: string;
};

export function parseUrlset(xml: string): SitemapUrl[] {
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  return blocks.map((block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim() ?? "";
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim();
    const image = block
      .match(/<image:loc>([^<]+)<\/image:loc>/)?.[1]
      ?.trim();
    return { loc, lastmod, image };
  }).filter((row) => row.loc);
}

export function readSitemap(
  archiveRoot: string,
  name: string,
): SitemapUrl[] {
  const file = path.join(archiveRoot, "meta", "sitemaps", name);
  if (!existsSync(file)) return [];
  return parseUrlset(readFileSync(file, "utf8"));
}

export function listRenderedPostFiles(archiveRoot: string): string[] {
  const dir = path.join(archiveRoot, "rendered");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(
      (name) =>
        name.startsWith("chalknpencil__post__") && name.endsWith(".html"),
    )
    .map((name) => path.join(dir, name));
}

export function slugFromPostFilename(filePath: string): string {
  const name = path.basename(filePath, ".html");
  return name.replace(/^chalknpencil__post__/, "");
}
