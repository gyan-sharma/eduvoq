import type { TipTapNode } from "../../src/content/tiptap";

export type ExtractedTag = {
  slug: string;
  name: string;
};

export type ExtractedPost = {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle?: string;
  seoDescription?: string;
  kind: "BLOG" | "EMAGAZINE";
  publishedAt: string;
  updatedAt?: string;
  sourceAuthor?: string;
  categorySlugs: string[];
  tagSlugs: string[];
  tags: ExtractedTag[];
  coverImageUrl?: string | null;
  sourcePath: string;
  sourceUrl: string;
  bodyJson: TipTapNode;
  bodyText: string;
  warnings: string[];
};

export type ExtractedPostsFile = {
  generatedAt: string;
  archiveRoot: string;
  count: number;
  posts: ExtractedPost[];
};

export type ExtractedPage = {
  wixPath: string;
  slug: string;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  sourcePath: string;
  bodyJson: TipTapNode;
  bodyText: string;
  warnings: string[];
};

export type ExtractedPagesFile = {
  generatedAt: string;
  archiveRoot: string;
  count: number;
  note: string;
  pages: ExtractedPage[];
};
