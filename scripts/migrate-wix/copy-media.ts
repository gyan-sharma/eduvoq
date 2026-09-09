import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { defaultArchiveRoot, resolveArchiveRoot } from "./archive";

export type MediaIndex = Record<string, string>;

const MEDIA_REL = ["wget/static.wixstatic.com/media", "mirror/static.wixstatic.com/media"];

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, out);
    else if (stat.isFile() && !name.endsWith(".tmp")) out.push(full);
  }
  return out;
}

function score(filePath: string): number {
  const size = statSync(filePath).size;
  let penalty = 0;
  if (filePath.includes("blur_")) penalty += 10_000_000;
  if (/\/w_(43|45|49|50|75|80|86|147),/.test(filePath)) penalty += 5_000_000;
  return size - penalty;
}

function sniffExt(filePath: string): string {
  const fromName = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }
  try {
    const fd = readFileSync(filePath).subarray(0, 12);
    if (fd[0] === 0x89 && fd[1] === 0x50) return ".png";
    if (fd[0] === 0xff && fd[1] === 0xd8) return ".jpg";
    if (fd.toString("ascii", 0, 4) === "RIFF" && fd.toString("ascii", 8, 12) === "WEBP") {
      return ".webp";
    }
    if (fd.toString("ascii", 0, 3) === "GIF") return ".gif";
  } catch {
    /* ignore */
  }
  return fromName || ".bin";
}

function publicName(folder: string, filePath: string): string {
  const ext = sniffExt(filePath);
  const id = folder.replaceAll("~", "-");
  return `${id}${ext}`;
}

function aliasKeys(folder: string): string[] {
  const keys = new Set([folder]);
  keys.add(folder.replaceAll("~", "_"));
  keys.add(folder.replaceAll("_mv2", "~mv2"));
  keys.add(folder.replaceAll("~mv2", "_mv2"));
  return [...keys];
}

export function copyArchiveMedia(options?: {
  cwd?: string;
  archiveRoot?: string;
}): { index: MediaIndex; count: number; bytes: number } {
  const cwd = options?.cwd ?? process.cwd();
  const archiveRoot = options?.archiveRoot ?? resolveArchiveRoot(cwd);
  if (!archiveRoot) {
    throw new Error(`Archive not found at ${defaultArchiveRoot(cwd)}`);
  }

  const destDir = path.join(cwd, "public", "wix");
  mkdirSync(destDir, { recursive: true });

  const best = new Map<string, string>();
  for (const rel of MEDIA_REL) {
    const root = path.join(archiveRoot, rel);
    if (!existsSync(root)) continue;
    for (const folder of readdirSync(root)) {
      const folderPath = path.join(root, folder);
      if (!statSync(folderPath).isDirectory()) continue;
      const files = walkFiles(folderPath);
      if (files.length === 0) continue;
      const winner = files.reduce((a, b) => (score(a) >= score(b) ? a : b));
      const prev = best.get(folder);
      if (!prev || score(winner) > score(prev)) best.set(folder, winner);
    }
  }

  const index: MediaIndex = {};
  let bytes = 0;
  for (const [folder, src] of best) {
    const name = publicName(folder, src);
    const dest = path.join(destDir, name);
    copyFileSync(src, dest);
    bytes += statSync(dest).size;
    const publicPath = `/wix/${name}`;
    for (const key of aliasKeys(folder)) {
      index[key] = publicPath;
    }
  }

  writeFileSync(
    path.join(cwd, "src", "content", "wix-media-index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
  );

  return { index, count: Object.keys(index).length, bytes };
}

function isMain(): boolean {
  const entry = process.argv[1]?.replaceAll("\\", "/");
  return Boolean(entry?.endsWith("copy-media.ts"));
}

if (isMain()) {
  const result = copyArchiveMedia();
  console.log(
    `Copied ${result.count} media files (${(result.bytes / 1024 / 1024).toFixed(1)} MB) → public/wix`,
  );
}
