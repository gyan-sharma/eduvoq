import type { Metadata } from "next";
import Link from "next/link";
import { PostStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { canPublishPost, canRejectPost } from "@/lib/admin-policy";
import { moderatePost } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Posts | Admin" };

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const posts = await prisma.post.findMany({
    where: {
      status: { in: [PostStatus.IN_REVIEW, PostStatus.DRAFT, PostStatus.REJECTED] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      kind: true,
      createdAt: true,
      author: { select: { email: true, name: true } },
    },
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Post moderation
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        IN_REVIEW submissions become public when published.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {posts.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No posts waiting for review.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="font-medium text-stone-900">{post.title}</p>
              <p className="mt-1 text-sm text-stone-600">
                {post.status} · {post.kind} · {post.author.name ?? post.author.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canPublishPost(post.status) ? (
                  <form action={moderatePost}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="decision" value="publish" />
                    <button className={`${buttonClass} w-auto`} type="submit">
                      Publish
                    </button>
                  </form>
                ) : null}
                {canRejectPost(post.status) ? (
                  <form action={moderatePost}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className={`${secondaryButtonClass} w-auto`} type="submit">
                      Reject
                    </button>
                  </form>
                ) : null}
                <Link
                  href={`/blog/${post.slug}`}
                  className="self-center text-sm text-emerald-800 hover:underline"
                >
                  Preview slug
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
