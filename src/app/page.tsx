import type { Metadata } from "next";

import { HomePage } from "@/components/home-page";
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  absoluteUrl,
} from "@/lib/site";
import { listPublishedBlogPosts } from "@/server/posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Home | EduVoq - Connecting Educators" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
  },
};

export default async function Home() {
  const posts = (await listPublishedBlogPosts()).slice(0, 3);
  return <HomePage posts={posts} />;
}
