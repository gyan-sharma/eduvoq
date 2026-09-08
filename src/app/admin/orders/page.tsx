import type { Metadata } from "next";
import Link from "next/link";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass } from "@/components/auth/ui";
import { fulfillmentLabel } from "@/lib/admin-policy";
import { formatInrPaise } from "@/lib/money";
import { orderStatusLabel } from "@/lib/types/commerce";
import { advanceOrder } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Orders | Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Orders
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        After payment, mark fulfilling → shipped → delivered. Self-ship India only.
      </p>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No orders yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {orders.map((order) => {
            const nextLabel = fulfillmentLabel(order.status);
            return (
              <li
                key={order.id}
                className="rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-stone-900">
                    {orderStatusLabel(order.status)} · {formatInrPaise(order.totalPaise)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {order.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {order.user.name ?? order.user.email}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {order.items
                    .map((item) => `${item.product.name} × ${item.qty}`)
                    .join(" · ")}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {nextLabel ? (
                    <form action={advanceOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className={`${buttonClass} w-auto`} type="submit">
                        {nextLabel}
                      </button>
                    </form>
                  ) : null}
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="self-center text-sm text-emerald-800 hover:underline"
                  >
                    Member view
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
