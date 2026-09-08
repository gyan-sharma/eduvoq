import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostStatus } from "@prisma/client";

import { AdminFlash } from "@/components/admin/flash";
import { CmsBody } from "@/components/cms-body";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import {
  canArchivePost,
  canPublishPost,
  canRejectPost,
} from "@/lib/admin-policy";
import { moderatePost } from "@/server/actions/admin";
import { getPostByIdForStaff } from "@/server/posts";

export const metadata: Metadata = { title: "Review post | Admin" };

export default async function AdminPostPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const post = await getPostByIdForStaff(id);
  if (!post) notFound();

  const publicWhenPublished = post.status === PostStatus.PUBLISHED;

  return (
    <main>
      <p className="text-sm text-stone-600">
        <Link href="/admin/posts" className="text-emerald-800 hover:underline">
          ← Queue
        </Link>
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-amber-800">
        Staff preview · {post.status} · not a public URL
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        {post.title}
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        {post.kind} · {post.authorName}
        {post.authorEmail ? ` (${post.authorEmail})` : ""} · {post.slug}
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {post.excerpt ? (
        <p className="mt-4 text-sm text-stone-700">{post.excerpt}</p>
      ) : null}
      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <CmsBody body={post.bodyJson} />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
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
        {canArchivePost(post.status) ? (
          <form action={moderatePost}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="decision" value="archive" />
            <button className={`${secondaryButtonClass} w-auto`} type="submit">
              Archive
            </button>
          </form>
        ) : null}
        {publicWhenPublished ? (
          <Link
            href={`/blog/${post.slug}`}
            className="self-center text-sm text-emerald-800 hover:underline"
          >
            Public page
          </Link>
        ) : null}
      </div>
    </main>
  );
}
