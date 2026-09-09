import Link from "next/link";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export async function NotificationsBadge() {
  const user = await getSessionUser();
  if (!user) return null;

  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  const label =
    unread > 0
      ? `Alerts (${unread > 99 ? "99+" : unread})`
      : "Alerts";

  return (
    <Link
      href="/account/notifications"
      className="relative hidden rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex"
    >
      {label}
      {unread > 0 ? (
        <span className="sr-only">{unread} unread notifications</span>
      ) : null}
    </Link>
  );
}
