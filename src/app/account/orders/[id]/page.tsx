import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { successClass } from "@/components/auth/ui";
import { PayOrderForm } from "@/components/payments/pay-form";
import { CancelOrderButton } from "@/components/store/cancel-order-button";
import { formatInrPaise } from "@/lib/money";
import { orderStatusLabel } from "@/lib/types/commerce";
import { releaseExpiredPendingOrders } from "@/server/commerce";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

type Params = { id: string };

export const metadata: Metadata = {
  title: "Order | EduVoq",
};

export default async function AccountOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ placed?: string; paid?: string; cancelled?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/orders");

  const { id } = await params;
  const { placed, paid, cancelled } = await searchParams;
  await releaseExpiredPendingOrders();

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      shippingAddress: true,
    },
  });
  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/account/orders" className="text-emerald-800 hover:underline">
          ← Orders
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Order
      </h1>
      {placed && order.status === OrderStatus.PENDING_PAYMENT ? (
        <p className={`${successClass} mt-4`}>
          Order placed. Complete payment within 15 minutes. Prepaid only — no
          cash on delivery.
        </p>
      ) : null}
      {paid &&
      (order.status === OrderStatus.PAID ||
        order.status === OrderStatus.FULFILLING) ? (
        <p className={`${successClass} mt-4`}>Payment received.</p>
      ) : null}
      {paid && order.status === OrderStatus.PENDING_PAYMENT ? (
        <p className={`${successClass} mt-4`}>
          If you already paid, this page updates when the webhook arrives.
        </p>
      ) : null}
      {cancelled && order.status === OrderStatus.PENDING_PAYMENT ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Checkout was cancelled. You can pay again below until the 15-minute
          hold expires.
        </p>
      ) : null}

      <dl className="mt-6 grid gap-2 text-sm text-stone-700">
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Status</dt>
          <dd className="font-medium">{orderStatusLabel(order.status)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Subtotal</dt>
          <dd className="font-medium">{formatInrPaise(order.subtotalPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>GST</dt>
          <dd className="font-medium">{formatInrPaise(order.taxPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Shipping</dt>
          <dd className="font-medium">{formatInrPaise(order.shippingPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Total</dt>
          <dd className="font-medium">{formatInrPaise(order.totalPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Invoice</dt>
          <dd className="font-medium">{order.invoiceNumber ?? "Assigned after payment"}</dd>
        </div>
        {order.buyerGstin ? (
          <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
            <dt>Buyer GSTIN</dt>
            <dd className="font-medium">{order.buyerGstin}</dd>
          </div>
        ) : null}
      </dl>

      <h2 className="mt-8 text-lg font-semibold text-stone-900">Items</h2>
      <ul className="mt-3 grid gap-2 text-sm text-stone-700">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span>
              {item.product.name} × {item.qty}
              {item.hsnSac ? ` · HSN ${item.hsnSac}` : ""}
            </span>
            <span>{formatInrPaise(item.qty * item.unitPaise)}</span>
          </li>
        ))}
      </ul>

      {order.shippingAddress ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">Ship to</h2>
          <p className="mt-2 text-sm text-stone-700">
            {order.shippingAddress.name}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
            {order.shippingAddress.postalCode}
            <br />
            India
          </p>
        </section>
      ) : null}

      {order.status === OrderStatus.PENDING_PAYMENT ? (
        <div className="mt-8 grid gap-6">
          <PayOrderForm orderId={order.id} />
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </main>
  );
}
