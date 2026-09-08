import { describe, expect, it } from "vitest";

import { plainTextToDoc, textFromTipTap } from "@/content/tiptap";
import { renderRobots, renderRss, renderUrlSet } from "@/lib/seo-xml";
import { RESERVED_POST_SLUGS, slugify, uniqueCandidate } from "@/lib/slug";
import { escapeXml } from "@/lib/xml";

describe("slugify", () => {
  it("turns titles into URL slugs", () => {
    expect(slugify("NEP 2020 in the Classroom")).toBe(
      "nep-2020-in-the-classroom",
    );
  });

  it("keeps reserved blog segments out of post paths", () => {
    expect(RESERVED_POST_SLUGS.has("submit")).toBe(true);
    expect(uniqueCandidate("lesson-planning", 2)).toBe("lesson-planning-2");
  });
});

describe("TipTap text", () => {
  it("round-trips plain text through a doc", () => {
    const doc = plainTextToDoc("First paragraph.\n\nSecond paragraph.");
    expect(textFromTipTap(doc)).toContain("First paragraph.");
    expect(textFromTipTap(doc)).toContain("Second paragraph.");
  });

  it("strips tags when the stored body is HTML", () => {
    expect(textFromTipTap("<p>Hello <strong>CBSE</strong></p>")).toBe(
      "Hello CBSE",
    );
  });
});

describe("SEO XML", () => {
  it("escapes reserved characters", () => {
    expect(escapeXml(`A & B <C> "x"`)).toBe(
      "A &amp; B &lt;C&gt; &quot;x&quot;",
    );
  });

  it("renders a sitemap urlset", () => {
    const xml = renderUrlSet([
      { loc: "https://www.eduvoq.com/blog", changefreq: "daily", priority: 0.8 },
    ]);
    expect(xml).toContain("<loc>https://www.eduvoq.com/blog</loc>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
  });

  it("renders an RSS channel with escaped titles", () => {
    const xml = renderRss(
      {
        title: "EduVoq Blog",
        link: "https://www.eduvoq.com/blog",
        description: "Posts",
        selfUrl: "https://www.eduvoq.com/rss.xml",
      },
      [
        {
          title: "NEP & the classroom",
          link: "https://www.eduvoq.com/blog/nep",
          description: "A <draft>",
          pubDate: "Wed, 21 Aug 2024 04:30:00 GMT",
        },
      ],
    );
    expect(xml).toContain("<title>NEP &amp; the classroom</title>");
    expect(xml).toContain("<description>A &lt;draft&gt;</description>");
    expect(xml).toContain('atom:link href="https://www.eduvoq.com/rss.xml"');
  });

  it("points robots.txt at the xml sitemap", () => {
    const body = renderRobots({
      sitemapUrl: "https://www.eduvoq.com/sitemap.xml",
      host: "www.eduvoq.com",
      disallow: ["/account", "/admin"],
    });
    expect(body).toContain("Sitemap: https://www.eduvoq.com/sitemap.xml");
    expect(body).toContain("Disallow: /account");
    expect(body).toContain("Host: www.eduvoq.com");
  });
});

describe("site identity", () => {
  it("uses EduVoq Connecting Educators copy", async () => {
    const { SITE_NAME, SITE_TAGLINE, SITE_TITLE, SITE_DESCRIPTION } =
      await import("@/lib/site");
    expect(SITE_NAME).toBe("EduVoq");
    expect(SITE_TAGLINE).toBe("Connecting Educators");
    expect(SITE_TITLE).toContain("Connecting Educators");
    expect(SITE_DESCRIPTION).toMatch(/advertisement-free/);
    expect(SITE_DESCRIPTION).toMatch(/school teachers/);
  });
});
