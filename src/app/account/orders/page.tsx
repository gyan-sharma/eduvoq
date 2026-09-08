import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInrPaise } from "@/lib/money";
import { orderStatusLabel } from "@/lib/types/commerce";
import { releaseExpiredPendingOrders } from "@/server/commerce";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders | EduVoq",
};

export default async function AccountOrdersPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/orders");

  await releaseExpiredPendingOrders();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Orders
      </h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">
          No orders yet.{" "}
          <Link href="/store" className="text-emerald-800 hover:underline">
            Visit the store
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-5 hover:border-emerald-800"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-stone-900">
                    {orderStatusLabel(order.status)}
                  </p>
                  <p className="text-sm font-medium text-stone-800">
                    {formatInrPaise(order.totalPaise)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {order.items
                    .map((item) => `${item.product.name} × ${item.qty}`)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {order.createdAt.toISOString().slice(0, 10)} · GST{" "}
                  {formatInrPaise(order.taxPaise)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
