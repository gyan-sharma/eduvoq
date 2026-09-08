import { escapeXml } from "@/lib/xml";

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

export type RssChannel = {
  title: string;
  link: string;
  description: string;
  language?: string;
  selfUrl: string;
};

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  guid?: string;
  author?: string;
  categories?: string[];
};

export function renderUrlSet(urls: SitemapUrl[]): string {
  const body = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
      if (url.lastmod) parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
      if (url.changefreq) {
        parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
      }
      if (typeof url.priority === "number") {
        parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function renderRss(channel: RssChannel, items: RssItem[]): string {
  const itemXml = items
    .map((item) => {
      const guid = item.guid ?? item.link;
      const rows = [
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(guid)}</guid>`,
        `      <description>${escapeXml(item.description)}</description>`,
      ];
      if (item.pubDate) {
        rows.push(`      <pubDate>${escapeXml(item.pubDate)}</pubDate>`);
      }
      if (item.author) {
        rows.push(`      <author>${escapeXml(item.author)}</author>`);
      }
      for (const category of item.categories ?? []) {
        rows.push(`      <category>${escapeXml(category)}</category>`);
      }
      return `    <item>\n${rows.join("\n")}\n    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${escapeXml(channel.language ?? "en-in")}</language>
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${itemXml}
  </channel>
</rss>
`;
}

export function renderRobots(input: {
  sitemapUrl: string;
  host?: string;
  disallow?: string[];
}): string {
  const disallow = (input.disallow ?? []).map((path) => `Disallow: ${path}`);
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...disallow,
    "",
    `Sitemap: ${input.sitemapUrl}`,
  ];
  if (input.host) {
    lines.push(`Host: ${input.host}`);
  }
  return `${lines.join("\n")}\n`;
}
