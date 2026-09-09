import Link from "next/link";
import type { ReactNode } from "react";

import { HOME_COPY, HOME_INTRO, PLAY_STORE_URL } from "@/content/home";
import { Button } from "@/components/ui/button";
import type { PostListItem } from "@/server/posts";
import { cn } from "@/lib/utils";

function SectionShell({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("px-4 py-16 sm:px-6 lg:px-8", className)}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {children}
      </div>
    </section>
  );
}

function ArchiveImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("mx-auto h-auto w-full max-w-lg object-contain", className)}
    />
  );
}

function Cta({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      asChild
      variant={variant}
      className="h-11 rounded-full px-6 text-sm font-semibold"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function HomePage({ posts }: { posts: PostListItem[] }) {
  return (
    <div className="bg-background">
      <SectionShell className="pt-10 pb-8 sm:pt-16">
        <div>
          {HOME_INTRO.map((p) => (
            <p key={p.slice(0, 24)} className="mt-4 text-lg leading-8 first:mt-0">
              {p}
            </p>
          ))}
          <h1 className="mt-8 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            {HOME_COPY.welcomeTitle}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/community">Go to Teacher Social</Cta>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/play-store.png"
                alt="Get it on Google Play"
                width={201}
                height={75}
                className="h-12 w-auto"
              />
            </a>
          </div>
        </div>
        <ArchiveImg src="/brand/community.png" alt="Educators connecting" />
      </SectionShell>

      <div className="grid gap-1 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {[
          "/brand/gallery-1.webp",
          "/brand/gallery-2.webp",
          "/brand/gallery-3.webp",
        ].map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className="h-48 w-full object-cover sm:h-64"
          />
        ))}
      </div>

      <SectionShell className="bg-muted/50">
        <ArchiveImg src="/brand/social.png" alt="Teacher social network" />
        <div>
          <p className="text-lg leading-8">{HOME_COPY.socialHeadline}</p>
          <h2 className="mt-6 font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.communityTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.socialBody}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/register">Join Now</Cta>
            <Cta href="/groups" variant="outline">
              Join a Group
            </Cta>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Forums
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.forumBody}
          </p>
          <div className="mt-8">
            <Cta href="/forum">Explore Forums</Cta>
          </div>
        </div>
        <ArchiveImg src="/brand/collab-teachers.png" alt="Teachers in discussion" />
      </SectionShell>

      <SectionShell className="bg-muted/50">
        <ArchiveImg src="/brand/blogs.png" alt="Blogs and articles" />
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Blogs and Articles
          </h2>
          <p className="mt-3 text-lg leading-8">{HOME_COPY.blogsHeadline}</p>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.blogsBody}
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-heading text-lg font-semibold hover:underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/blog">Explore Further</Cta>
            <Cta href="/blog/submit" variant="outline">
              Submit your Blog
            </Cta>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.consultTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.toolkitLead}
          </p>
          <ul className="mt-6 list-disc space-y-1 pl-5 text-base">
            {HOME_COPY.toolkitItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/consult">Book your Slot</Cta>
            <Cta href="/contact" variant="outline">
              Register as Mentor
            </Cta>
          </div>
        </div>
        <ArchiveImg src="/brand/consult.png" alt="Consultancy services" />
      </SectionShell>

      <SectionShell className="bg-muted/50">
        <ArchiveImg src="/brand/classroom.png" alt="Classroom" />
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.schoolTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.schoolBody}
          </p>
          <div className="mt-8">
            <Cta href="/services">Explore Further</Cta>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div>
          <p className="text-lg leading-8">{HOME_COPY.learningHeadline}</p>
          <h2 className="mt-6 font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.learningTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground/85">
            {HOME_COPY.learningBody}
          </p>
          <div className="mt-8">
            <Cta href="/resources">Our Resource Center</Cta>
          </div>
        </div>
        <ArchiveImg src="/brand/learning.png" alt="Learning materials" />
      </SectionShell>

      <SectionShell className="bg-muted/50">
        <ArchiveImg src="/brand/student-stressed.png" alt="Career choices" />
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.careerTitle}
          </h2>
          {HOME_COPY.careerBody.map((p) => (
            <p key={p.slice(0, 32)} className="mt-4 text-base leading-7 text-foreground/85">
              {p}
            </p>
          ))}
          <div className="mt-8">
            <Cta href="/contact">Connect with us</Cta>
          </div>
        </div>
      </SectionShell>

      <section className="bg-foreground px-4 py-16 text-background sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            {HOME_COPY.subscribeTitle}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-background/80">
            Join EduVoq to follow blogs, book consultations, and take part in
            the teacher community.
          </p>
          <div className="mt-8">
            <Button
              asChild
              className="h-11 rounded-full bg-background px-8 text-sm font-semibold text-foreground hover:bg-background/90"
            >
              <Link href="/register">Join</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
