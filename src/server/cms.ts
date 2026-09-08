import type { Metadata } from "next";

import { cmsPageBySlug, type CmsPageSeed } from "@/content/cms";
import { prisma } from "@/server/db";

export type CmsPageView = {
  slug: string;
  title: string;
  bodyJson: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
};

function fromSeed(page: CmsPageSeed): CmsPageView {
  return {
    slug: page.slug,
    title: page.title,
    bodyJson: page.bodyJson,
    seoTitle: page.seoTitle ?? null,
    seoDescription: page.seoDescription ?? null,
  };
}

export async function getCmsPage(slug: string): Promise<CmsPageView | null> {
  const fallback = cmsPageBySlug[slug];
  try {
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (page) {
      if (!page.published) return null;
      return {
        slug: page.slug,
        title: page.title,
        bodyJson: page.bodyJson,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      };
    }
  } catch {
    // MySQL is optional for local `next build`; fall back to seed copy.
  }
  return fallback ? fromSeed(fallback) : null;
}

export async function listCmsPagesForAdmin() {
  return prisma.cmsPage.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      updatedAt: true,
    },
  });
}

export function cmsPageMetadata(slug: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const page = await getCmsPage(slug);
    if (!page) return {};
    return {
      title: page.seoTitle ?? page.title,
      description: page.seoDescription ?? undefined,
    };
  };
}
