import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const PAGES: Array<{ wixPath: string; slug: string; title: string }> = [
  { wixPath: "about-us", slug: "about", title: "About Us" },
  { wixPath: "privacy-policy", slug: "privacy", title: "Privacy Policy" },
  { wixPath: "tnc", slug: "terms", title: "Terms and Conditions" },
  { wixPath: "careers", slug: "careers", title: "Careers" },
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
];

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
  if (compact.length < 40 && compact.includes("explore various functions")) {
    return false;
  }
  return false;
}

function extractPage(
  archiveRoot: string,
  spec: (typeof PAGES)[number],
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
      warnings: ["html-missing"],
    };
  }

  const html = readFileSync(sourcePath, "utf8");
  const $ = loadHtml(html);
  const title =
    $("title").first().text().replace(/\s*\|\s*EduVoq.*$/i, "").trim() ||
    spec.title;
  const seoDescription = metaContent($, "og:description");

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

  let bodyJson: TipTapNode = selectionToDoc($, kept);
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

  const pages = PAGES.map((spec) => extractPage(archiveRoot, spec));
  const payload: ExtractedPagesFile = {
    generatedAt: new Date().toISOString(),
    archiveRoot,
    count: pages.length,
    note: "Raw Wix text for editorial review. Do not overwrite polished CmsPage seed without a human pass (poems vs prose).",
    pages,
  };

  if (options?.write !== false) {
    const dir = migrationDir(cwd);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "pages.json"),
      `${JSON.stringify(payload, null, 2)}\n`,
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
      `Extracted ${result.count} pages → ${path.join(migrationDir(), "pages.json")}`,
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
