import Link from "next/link";
import { redirect } from "next/navigation";
import { BodyText } from "@/components/community/body-text";
import { formatCommunityWhen } from "@/lib/community";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export default async function AccountPostsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [feedPosts, groupPosts] = await Promise.all([
    prisma.feedPost.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, bodyJson: true, createdAt: true },
    }),
    prisma.groupPost.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        bodyJson: true,
        createdAt: true,
        group: { select: { slug: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        My posts
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Teacher Social posts and group discussions you wrote.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-stone-900">
        Teacher Social
      </h2>
      {feedPosts.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">
          No Teacher Social posts yet.{" "}
          <Link href="/community" className="font-medium text-emerald-800 hover:underline">
            Open the feed
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {feedPosts.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="text-xs text-stone-500">
                {formatCommunityWhen(post.createdAt)}
              </p>
              <div className="mt-2 text-sm">
                <BodyText value={post.bodyJson} />
              </div>
              <p className="mt-2 text-sm">
                <Link
                  href={`/community?post=${encodeURIComponent(post.id)}`}
                  className="font-medium text-emerald-800 hover:underline"
                >
                  View on Teacher Social
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-stone-900">Groups</h2>
      {groupPosts.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">No group posts yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {groupPosts.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <p className="text-xs text-stone-500">
                {post.group.name} · {formatCommunityWhen(post.createdAt)}
              </p>
              <div className="mt-2 text-sm">
                <BodyText value={post.bodyJson} />
              </div>
              <p className="mt-2 text-sm">
                <Link
                  href={`/groups/${post.group.slug}`}
                  className="font-medium text-emerald-800 hover:underline"
                >
                  Open group
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
