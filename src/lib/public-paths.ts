import { serviceLinks } from "@/lib/nav";

export const sitemapStaticPaths = [
  "/",
  "/about",
  "/contact",
  "/careers",
  "/news",
  "/privacy",
  "/terms",
  "/sitemap",
  "/pricing",
  "/services",
  "/consult",
  "/blog",
  "/blog/submit",
  "/members",
  "/store",
  "/sample-papers",
  "/events",
] as const;

export function marketingSitemapPaths(): string[] {
  const services = serviceLinks.map((item) => item.href);
  return [...sitemapStaticPaths, ...services];
}
