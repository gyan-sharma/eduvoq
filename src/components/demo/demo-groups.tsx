import Link from "next/link";

import { AuthorChip } from "@/components/community/author-chip";
import { BodyText } from "@/components/community/body-text";
import { CommunityNav } from "@/components/community/community-nav";
import { DemoBanner } from "@/components/demo/demo-banner";
import { PollVoteForm } from "@/components/groups/poll-vote-form";
import {
  DEMO_GROUPS,
  type DemoGroup,
} from "@/lib/demo-content";
import { formatCommunityWhen } from "@/lib/community";
import { plainTextToDoc } from "@/lib/tiptap-text";

export function DemoGroupsIndex() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <DemoBanner surface="groups list" />
      <p className="mt-6 text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Groups
      </h1>
      <p className="mt-3 text-muted-foreground">
        Sample groups. Official spaces include Job Alerts, Social Network, and
        Student Circle.
      </p>
      <CommunityNav current="/groups" />
      <ul className="mt-10 grid gap-4">
        {DEMO_GROUPS.map((group) => (
          <li
            key={group.slug}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Official group
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
              <Link href={`/groups/${group.slug}`} className="hover:underline">
                {group.name}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {group.description}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {group.memberCount} members · {group.postCount} posts
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DemoGroupDetail({ group }: { group: DemoGroup }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <DemoBanner surface="group" />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/groups" className="text-primary hover:underline">
          ← Groups
        </Link>
      </p>
      <CommunityNav current={`/groups/${group.slug}`} />
      <header className="mt-6">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Official group
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {group.name}
        </h1>
        <p className="mt-3 text-muted-foreground">{group.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {group.memberCount} members · {group.postCount} posts
        </p>
      </header>
      <ul className="mt-10 grid gap-4">
        {group.posts.map((post) => (
          <li
            key={post.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <AuthorChip
                name={post.author.name}
                username={post.author.username}
                image={post.author.image}
              />
              <time
                className="shrink-0 text-xs text-muted-foreground"
                dateTime={post.createdAt.toISOString()}
              >
                {formatCommunityWhen(post.createdAt)}
              </time>
            </div>
            <div className="mt-4">
              <BodyText value={plainTextToDoc(post.body)} />
            </div>
            {post.poll ? (
              <PollVoteForm
                groupPostId={post.id}
                question={post.poll.question}
                options={post.poll.options}
                counts={post.poll.counts}
                myOptionIdx={null}
                canVote={false}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
