import type { Metadata } from "next";
import Link from "next/link";
import { PostStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
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
      excerpt: true,
      status: true,
      kind: true,
      createdAt: true,
      author: { select: { email: true, name: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Post moderation
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Open a submission to read the body, then publish or reject. Public{" "}
        <code className="text-xs">/blog/[slug]</code> stays published-only.
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
              {post.excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm text-stone-700">
                  {post.excerpt}
                </p>
              ) : null}
              <p className="mt-3">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="text-sm font-medium text-emerald-800 hover:underline"
                >
                  Review body
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
