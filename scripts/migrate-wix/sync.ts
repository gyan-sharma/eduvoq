import { copyArchiveMedia } from "./copy-media";
import { extractPages } from "./extract-pages";
import { extractPosts } from "./extract-posts";
import { localWixMediaPath } from "./wix-urls";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadIndex(cwd: string): Record<string, string> {
  const file = path.join(cwd, "src", "content", "wix-media-index.json");
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
}

function main() {
  const cwd = process.cwd();
  const media = copyArchiveMedia({ cwd });
  console.log(
    `Media: ${media.count} files (${(media.bytes / 1024 / 1024).toFixed(1)} MB)`,
  );

  const pages = extractPages({ cwd });
  console.log(`Pages: ${pages.count}`);

  const posts = extractPosts({ cwd });
  const index = loadIndex(cwd);
  const covers: Record<string, string> = {};
  for (const post of posts.posts) {
    if (!post.coverImageUrl) continue;
    const local = localWixMediaPath(post.coverImageUrl, index);
    if (local) covers[post.slug] = local;
  }
  mkdirSync(path.join(cwd, "src", "content"), { recursive: true });
  writeFileSync(
    path.join(cwd, "src", "content", "post-covers.json"),
    `${JSON.stringify(covers, null, 2)}\n`,
  );
  console.log(`Posts: ${posts.count}, covers: ${Object.keys(covers).length}`);
}

main();
