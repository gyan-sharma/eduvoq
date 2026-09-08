import Link from "next/link";

import { DemoBanner } from "@/components/demo/demo-banner";
import { AuthorByline } from "@/components/forum/author-byline";
import { PostBody } from "@/components/forum/post-body";
import { ThreadRow } from "@/components/forum/thread-row";
import {
  DEMO_FORUM_CATEGORIES,
  DEMO_FORUM_THREADS,
  demoForumAuthor,
  getDemoForumThreads,
  type DemoForumThread,
} from "@/lib/demo-content";
import { formatForumDate, formatForumDay } from "@/lib/forum";
import { plainTextToDoc } from "@/lib/tiptap-text";

export function DemoForumIndex() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <DemoBanner surface="forum" />
      <p className="mt-6 text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Forums
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Sample educator forum. Categories stay public; starting a thread
        requires an active member session once demo mode is off.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_FORUM_CATEGORIES.map((category) => (
          <li key={category.slug}>
            <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                <Link
                  href={`/forum/${category.slug}`}
                  className="hover:underline"
                >
                  {category.name}
                </Link>
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {category.description}
              </p>
              <p className="mt-auto pt-4 text-sm text-muted-foreground">
                {category.threadCount}{" "}
                {category.threadCount === 1 ? "thread" : "threads"}
              </p>
            </article>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-heading text-xl font-semibold tracking-tight">
        Recent threads
      </h2>
      <ul className="mt-4 grid gap-3">
        {DEMO_FORUM_THREADS.map((thread) => (
          <li key={thread.slug}>
            <DemoThreadRow thread={thread} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DemoForumCategory({
  slug,
  name,
  description,
}: {
  slug: string;
  name: string;
  description: string;
}) {
  const threads = getDemoForumThreads(slug);
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <DemoBanner surface="forum category" />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/forum" className="text-primary hover:underline">
          Forums
        </Link>
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        {name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
      {threads.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          No sample threads in this category yet.
        </p>
      ) : (
        <ul className="mt-10 grid gap-3">
          {threads.map((thread) => (
            <li key={thread.slug}>
              <DemoThreadRow thread={thread} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DemoForumThread({ thread }: { thread: DemoForumThread }) {
  const category = DEMO_FORUM_CATEGORIES.find(
    (item) => item.slug === thread.categorySlug,
  );
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <DemoBanner surface="forum thread" />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/forum" className="text-primary hover:underline">
          Forums
        </Link>
        {category ? (
          <>
            {" · "}
            <Link
              href={`/forum/${category.slug}`}
              className="text-primary hover:underline"
            >
              {category.name}
            </Link>
          </>
        ) : null}
      </p>
      <header className="mt-4">
        {thread.pinned ? (
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Pinned
          </p>
        ) : null}
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          {thread.title}
        </h1>
        <div className="mt-4">
          <AuthorByline
            author={demoForumAuthor(thread.author)}
            when={formatForumDate(thread.createdAt)}
          />
        </div>
      </header>
      <ol className="mt-8 grid gap-4">
        {thread.posts.map((post) => (
          <li
            key={post.id}
            id={post.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <AuthorByline
              author={demoForumAuthor(post.author)}
              when={formatForumDate(post.createdAt)}
            />
            <div className="mt-3">
              <PostBody bodyJson={plainTextToDoc(post.body)} />
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function DemoThreadRow({ thread }: { thread: DemoForumThread }) {
  const category = DEMO_FORUM_CATEGORIES.find(
    (item) => item.slug === thread.categorySlug,
  );
  return (
    <ThreadRow
      href={`/forum/${thread.categorySlug}/${thread.slug}`}
      title={thread.title}
      excerpt={thread.excerpt}
      author={demoForumAuthor(thread.author)}
      when={formatForumDay(thread.createdAt)}
      replyCount={thread.replyCount}
      pinned={thread.pinned}
      category={
        category
          ? { href: `/forum/${category.slug}`, name: category.name }
          : undefined
      }
    />
  );
}
