import { describe, expect, it } from "vitest";

import redirectsFile from "../redirects.json";
import { missingArchiveMessage } from "../scripts/migrate-wix/archive";
import { fragmentToDoc } from "../scripts/migrate-wix/html-to-tiptap";
import { rewriteWixHref } from "../scripts/migrate-wix/wix-urls";
import { textFromTipTap } from "../src/content/tiptap";

describe("Wix redirects", () => {
  const rows = Array.isArray(redirectsFile) ? redirectsFile : [];
  const sources = new Set(rows.map((row: { source: string }) => row.source));

  it("maps /my-* and /account/my-* account shells", () => {
    expect(sources.has("/my-account")).toBe(true);
    expect(sources.has("/my-wallet")).toBe(true);
    expect(sources.has("/account/my-account")).toBe(true);
    expect(sources.has("/account/my-wallet")).toBe(true);
    expect(
      rows.find((row: { source: string }) => row.source === "/my-wallet")
        ?.destination,
    ).toBe("/account/wallet");
    expect(
      rows.find((row: { source: string }) => row.source === "/account/my-wallet")
        ?.destination,
    ).toBe("/account/wallet");
  });

  it("maps Wix blog posts onto /blog/:slug", () => {
    expect(
      rows.find((row: { source: string }) => row.source === "/post/:slug")
        ?.destination,
    ).toBe("/blog/:slug");
  });

  it("maps Wix in-body hashtags onto /blog/tags/:slug", () => {
    expect(
      rows.find((row: { source: string }) => row.source === "/blog/hashtags/:slug")
        ?.destination,
    ).toBe("/blog/tags/:slug");
  });
});

describe("rewriteWixHref", () => {
  it("drops the wixsite prefix and applies the redirect map", () => {
    expect(
      rewriteWixHref(
        "https://eduvoq.wixsite.com/chalknpencil/post/maxims-of-teaching",
      ),
    ).toBe("/blog/maxims-of-teaching");
    expect(
      rewriteWixHref("https://eduvoq.wixsite.com/chalknpencil/about-us"),
    ).toBe("/about");
    expect(rewriteWixHref("/my-wallet")).toBe("/account/wallet");
  });

  it("rewrites /blog/hashtags links onto /blog/tags", () => {
    expect(
      rewriteWixHref(
        "https://eduvoq.wixsite.com/chalknpencil/blog/hashtags/education",
      ),
    ).toBe("/blog/tags/education");
    expect(
      rewriteWixHref(
        "https://eduvoq.wixsite.com/chalknpencil/blog/hashtags/LessonPlan",
      ),
    ).toBe("/blog/tags/lesson-plan");
  });
});

describe("html-to-tiptap", () => {
  it("converts nested Wix spans, lists, and headings", () => {
    const doc = fragmentToDoc(`
      <h2><span><strong>Maxims</strong></span></h2>
      <p><span>Teach from known to <strong>unknown</strong>.</span></p>
      <ul><li><p>Plan the period.</p></li><li><p>Leave a written trace.</p></li></ul>
      <p><a href="https://eduvoq.wixsite.com/chalknpencil/about-us">About</a></p>
    `);
    const text = textFromTipTap(doc);
    expect(text).toContain("Maxims");
    expect(text).toContain("Teach from known to unknown.");
    expect(text).toContain("Plan the period.");
    const json = JSON.stringify(doc);
    expect(json).toContain('"type":"heading"');
    expect(json).toContain('"type":"bulletList"');
    expect(json).toContain('"/about"');
    expect(json).toContain('"type":"bold"');
  });

  it("drops ZWSP-only Wix placeholders and spaces glued spans", () => {
    const empty = fragmentToDoc(
      `<div data-testid="richTextElement"><p>&#8203;</p><p>Hello</p></div>`,
    );
    expect(textFromTipTap(empty)).toBe("Hello");
    expect(JSON.stringify(empty)).not.toContain("\u200b");

    const glued = fragmentToDoc(
      `<p><span>development.</span><span>Language</span></p>`,
    );
    expect(textFromTipTap(glued)).toContain("development. Language");
  });
});

describe("archive missing message", () => {
  it("tells the operator to set ARCHIVE_ROOT and not git-add the snapshot", () => {
    const message = missingArchiveMessage("/tmp/chalknpencil-archive");
    expect(message).toContain("ARCHIVE_ROOT");
    expect(message).toContain("Do not git-add the archive");
  });
});
