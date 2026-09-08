import Link from "next/link";

import { CommunityNav } from "@/components/community/community-nav";
import { FeedPostCard } from "@/components/community/feed-post-card";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DEMO_FEED_POSTS } from "@/lib/demo-content";

export function DemoCommunityPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <DemoBanner surface="Teacher Social feed" />
      <p className="mt-6 text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Teacher Social
      </h1>
      <p className="mt-3 text-muted-foreground">
        Sample educator feed. Posts here are member-visible once demo mode is
        off. There is no private inbox or DMs.
      </p>
      <CommunityNav current="/community" />
      <p className="mt-6 text-sm text-muted-foreground">
        Looking for a group?{" "}
        <Link href="/groups" className="font-medium text-primary hover:underline">
          Browse Job Alerts and Social Network
        </Link>
        .
      </p>
      <ul className="mt-10 grid gap-4">
        {DEMO_FEED_POSTS.map((item) => (
          <li key={item.id}>
            <FeedPostCard
              post={item}
              comments={item.comments}
              commentCount={item.commentCount}
              canComment={false}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
