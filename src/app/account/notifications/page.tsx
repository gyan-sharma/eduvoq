import Link from "next/link";
import { redirect } from "next/navigation";
import { markNotificationsRead } from "@/server/actions/notifications";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";
import { buttonClass } from "@/components/auth/ui";

export const dynamic = "force-dynamic";

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((row) => !row.readAt).length;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Follows, group posts, and comments land here. There is no private
            inbox or DMs.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsRead}>
            <button type="submit" className={`${buttonClass} w-auto`}>
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-sm text-stone-600">
          No notifications yet. When another member follows you, it will show
          up here.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {notifications.map((item) => (
            <li
              key={item.id}
              className={item.readAt ? "bg-white" : "bg-emerald-50/60"}
            >
              {item.href ? (
                <Link href={item.href} className="block px-5 py-4 hover:bg-stone-50">
                  <p className="font-medium text-stone-900">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 text-sm text-stone-600">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-stone-500">
                    {formatWhen(item.createdAt)}
                  </p>
                </Link>
              ) : (
                <div className="px-5 py-4">
                  <p className="font-medium text-stone-900">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 text-sm text-stone-600">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-stone-500">
                    {formatWhen(item.createdAt)}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
