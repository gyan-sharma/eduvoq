import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { textFromTipTap, type TipTapNode } from "../../src/content/tiptap";
import {
  defaultArchiveRoot,
  findPageHtml,
  migrationDir,
  missingArchiveMessage,
  resolveArchiveRoot,
} from "./archive";
import { loadHtml, selectionToDoc } from "./html-to-tiptap";
import type { ExtractedPage, ExtractedPagesFile } from "./types";
import { localWixMediaPath } from "./wix-urls";

const CHROME = new Set(
  [
    "About Us",
    "Mission & Vision",
    "Blogs & Articles",
    "Careers",
    "Teacher Social",
    "EduVoq Forums",
    "Community Members",
    "Contact Us",
    "Consulting Services",
    "Learning Material",
    "Log In",
    "Sign Up",
    "Home",
    "Privacy Policy",
    "Terms and Conditions",
  ].map((label) => label.toLowerCase()),
);

const CHROME_MEDIA = [
  "79e3e9_d31b26e37f984d3299a4bdcd09608d5b",
  "79e3e9_2d5e61d0298c497b8b1b8f3e1b2f036b",
  "79e3e9_fb03906acf714ed1b80324e5339ba0ed",
  "79e3e9_108cbac040e2460998d2817315e044a1",
  "79e3e9_80a7283abc0d449f8baea7f342e8927f",
  "79e3e9_df906e3e673a40fbadaed48026be969b",
  "79e3e9_b634ee416f194cce9f558b6c5066ee75",
  "79e3e9_4b0a9e7f35c447ef95f588d670fa7699",
];

const PAGES: Array<{ wixPath: string; slug: string; title: string }> = [
  { wixPath: "about-us", slug: "about", title: "About Us" },
  { wixPath: "privacy-policy", slug: "privacy", title: "Privacy Policy" },
  { wixPath: "tnc", slug: "terms", title: "Terms and Conditions" },
  { wixPath: "careers", slug: "careers", title: "Careers" },
  { wixPath: "contact", slug: "contact", title: "Contact" },
  { wixPath: "news", slug: "news", title: "News" },
  { wixPath: "expert-consultation", slug: "consult", title: "Expert Consultation" },
  { wixPath: "sample-papers", slug: "sample-papers", title: "Lesson Plans" },
  { wixPath: "plans-pricing", slug: "pricing", title: "Plans & Pricing" },
  { wixPath: "school-management", slug: "services/school-management", title: "School Management" },
  { wixPath: "school-infrastructure", slug: "services/infrastructure", title: "School Infrastructure" },
  { wixPath: "admissions", slug: "services/admissions", title: "Admissions" },
  { wixPath: "examination", slug: "services/examinations", title: "Examination" },
  { wixPath: "time-table-management", slug: "services/timetable", title: "Time Table" },
  { wixPath: "sports", slug: "services/sports", title: "Sports" },
  { wixPath: "government-schemes", slug: "services/government-schemes", title: "Government Schemes" },
  { wixPath: "seminars", slug: "services/seminars", title: "Seminars" },
  { wixPath: "student-visits", slug: "services/student-visits", title: "Student Visits" },
  { wixPath: "cultural-activities", slug: "services/cultural-activities", title: "Cultural Activities" },
  { wixPath: "copy-of-cultural-activities", slug: "services/marketing", title: "School Marketing" },
  { wixPath: "accounting-and-taxation", slug: "services/accounting-taxation", title: "Accounting and Taxes" },
  { wixPath: "procurement", slug: "services/procurement", title: "Procurement" },
  { wixPath: "student-health-and-safety", slug: "services/health-safety", title: "Student Health and Safety" },
  { wixPath: "career-counselling", slug: "services/career-counselling", title: "Career Counselling" },
  {
    wixPath: "service-page/admission-consulting-advisory",
    slug: "consult/admission-consulting-advisory",
    title: "Admission Consulting & Advisory",
  },
  {
    wixPath: "service-page/career-options-and-counselling",
    slug: "consult/career-options-counselling",
    title: "Career Options and Counselling",
  },
  {
    wixPath: "service-page/psychology-consultation",
    slug: "consult/psychology-consultation",
    title: "Psychology Consultation",
  },
];

type MediaIndex = Record<string, string>;

function loadMediaIndex(cwd: string): MediaIndex {
  const file = path.join(cwd, "src", "content", "wix-media-index.json");
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8")) as MediaIndex;
}

function isChromeMedia(folderOrPath: string): boolean {
  return CHROME_MEDIA.some((id) => folderOrPath.includes(id));
}

function collectImages(html: string, index: MediaIndex): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /static\.wixstatic\.com\/media\/([^/?#"'\s]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const folder = decodeURIComponent(match[1]);
    if (isChromeMedia(folder)) continue;
    const local =
      index[folder] ||
      index[folder.replaceAll("~", "_")] ||
      index[folder.replaceAll("_mv2", "~mv2")];
    if (local && !seen.has(local)) {
      seen.add(local);
      out.push(local);
    }
  }
  return out;
}

function rewriteDocMedia(node: TipTapNode, index: MediaIndex): TipTapNode {
  const next: TipTapNode = { ...node };
  if (node.type === "image" && node.attrs?.src) {
    const local = localWixMediaPath(String(node.attrs.src), index);
    next.attrs = {
      ...node.attrs,
      src: local ?? node.attrs.src,
    };
  }
  if (node.content) {
    next.content = node.content.map((child) => rewriteDocMedia(child, index));
  }
  return next;
}

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

function isChromeText(text: string, pageTitle: string): boolean {
  const compact = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!compact) return true;
  if (compact === pageTitle.toLowerCase()) return true;
  if (CHROME.has(compact)) return true;
  return false;
}

function extractPage(
  archiveRoot: string,
  spec: (typeof PAGES)[number],
  mediaIndex: MediaIndex,
): ExtractedPage {
  const sourcePath = findPageHtml(archiveRoot, spec.wixPath);
  const warnings: string[] = [];
  if (!sourcePath) {
    return {
      wixPath: spec.wixPath,
      slug: spec.slug,
      title: spec.title,
      sourcePath: "",
      bodyJson: { type: "doc", content: [{ type: "paragraph", content: [] }] },
      bodyText: "",
      images: [],
      warnings: ["html-missing"],
    };
  }

  const html = readFileSync(sourcePath, "utf8");
  const $ = loadHtml(html);
  const title =
    $("title").first().text().replace(/\s*\|\s*EduVoq.*$/i, "").trim() ||
    spec.title;
  const seoDescription = metaContent($, "og:description");
  const images = collectImages(html, mediaIndex);

  const candidates = $("[data-testid='richTextElement']").filter(
    (_i: number, el: unknown) => {
      return (
        $(el as never).closest("#SITE_HEADER, #SITE_FOOTER, header, footer")
          .length === 0
      );
    },
  );

  const kept = candidates.filter((_i: number, el: unknown) => {
    const text = $(el as never).text().replace(/\s+/g, " ").trim();
    return !isChromeText(text, spec.title) && text.length > 8;
  });

  let bodyJson: TipTapNode = rewriteDocMedia(selectionToDoc($, kept), mediaIndex);
  let bodyText = textFromTipTap(bodyJson);
  if (!bodyText) {
    warnings.push("empty-body");
    bodyJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
    };
    bodyText = title;
  }

  return {
    wixPath: spec.wixPath,
    slug: spec.slug,
    title,
    seoTitle: title,
    seoDescription: seoDescription || undefined,
    sourcePath: path.relative(archiveRoot, sourcePath),
    bodyJson,
    bodyText,
    images,
    warnings,
  };
}

export function extractPages(options?: {
  archiveRoot?: string;
  cwd?: string;
  write?: boolean;
}): ExtractedPagesFile {
  const cwd = options?.cwd ?? process.cwd();
  const archiveRoot = options?.archiveRoot ?? resolveArchiveRoot(cwd);
  if (!archiveRoot) {
    throw new Error(missingArchiveMessage(defaultArchiveRoot(cwd)));
  }

  const mediaIndex = loadMediaIndex(cwd);
  const pages = PAGES.map((spec) => extractPage(archiveRoot, spec, mediaIndex));
  const payload: ExtractedPagesFile = {
    generatedAt: new Date().toISOString(),
    archiveRoot,
    count: pages.length,
    note: "Extracted from chalknpencil-archive for the EduVoq rebuild.",
    pages,
  };

  if (options?.write !== false) {
    const dir = migrationDir(cwd);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "pages.json"),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    writeFileSync(
      path.join(cwd, "src", "content", "archive-pages.json"),
      `${JSON.stringify(
        {
          generatedAt: payload.generatedAt,
          pages: pages.map((page) => ({
            slug: page.slug,
            title: page.title,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            bodyJson: page.bodyJson,
            images: page.images,
          })),
        },
        null,
        2,
      )}\n`,
    );
  }

  return payload;
}

function isMain(): boolean {
  const entry = process.argv[1]?.replaceAll("\\", "/");
  return Boolean(entry?.endsWith("extract-pages.ts"));
}

if (isMain()) {
  try {
    const result = extractPages();
    console.log(
      `Extracted ${result.count} pages → src/content/archive-pages.json`,
    );
    const thin = result.pages.filter((page) => page.warnings.length > 0);
    if (thin.length > 0) {
      console.warn(
        `Pages with warnings: ${thin.map((page) => `${page.slug} (${page.warnings.join(",")})`).join("; ")}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

