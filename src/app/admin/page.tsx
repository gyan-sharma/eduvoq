import type { Metadata } from "next";
import Link from "next/link";
import {
  BookingStatus,
  OrderStatus,
  PostStatus,
  ReportStatus,
  ResourceStatus,
} from "@prisma/client";

import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Admin | EduVoq" };

export default async function AdminDashboardPage() {
  const [
    users,
    inReviewPosts,
    openReports,
    upcomingBookings,
    openOrders,
    inReviewResources,
    publishedEvents,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count({ where: { status: PostStatus.IN_REVIEW } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.booking.count({
      where: {
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
      },
    }),
    prisma.order.count({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.FULFILLING, OrderStatus.SHIPPED],
        },
      },
    }),
    prisma.resource.count({ where: { status: ResourceStatus.IN_REVIEW } }),
    prisma.event.count({ where: { published: true } }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  const cards = [
    { href: "/admin/users", label: "Users", value: users },
    { href: "/admin/posts", label: "Posts in review", value: inReviewPosts },
    { href: "/admin/reports", label: "Open reports", value: openReports },
    { href: "/admin/bookings", label: "Open bookings", value: upcomingBookings },
    { href: "/admin/orders", label: "Orders to ship", value: openOrders },
    { href: "/admin/resources", label: "Resources in review", value: inReviewResources },
    { href: "/admin/events", label: "Published events", value: publishedEvents },
  ];

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Admin
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Staff console for users, content, bookings, orders, and flags.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-emerald-800"
            >
              <p className="text-sm text-stone-600">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-stone-900">
                {card.value}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Recent audit</h2>
          <Link href="/admin/audit" className="text-sm text-emerald-800 hover:underline">
            View all
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">No audit events yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {recentAudit.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-stone-900">{row.action}</p>
                <p className="text-stone-600">
                  {row.entity} · {row.actor?.email ?? "system"} ·{" "}
                  {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
