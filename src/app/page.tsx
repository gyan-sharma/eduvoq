import type { Metadata } from "next";
import Link from "next/link";

import { PostList } from "@/components/post-list";
import { Button } from "@/components/ui/button";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-16">
      <section className="text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {SITE_NAME}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{SITE_TAGLINE}</p>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
          {SITE_DESCRIPTION}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/consult">Book a consultation</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/blog">Read the blog</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/members">Community members</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="home-mission">
        <h2 id="home-mission" className="font-heading text-2xl font-semibold tracking-tight">
          Mission
        </h2>
        <p className="mt-3 text-muted-foreground">
          Empower educators and K-12 students with collaboration, innovation,
          and continuous learning — consulting sessions, curated learning
          materials, blogs, forums, education news, and social networking,
          without turning the platform into an advertisement board.
        </p>
      </section>

      {posts.length > 0 ? (
        <section className="mt-16" aria-labelledby="home-blog">
          <h2 id="home-blog" className="font-heading text-2xl font-semibold tracking-tight">
            From the blog
          </h2>
          <div className="mt-6">
            <PostList posts={posts} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
