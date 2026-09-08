import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/flash";
import { buttonClass } from "@/components/auth/ui";
import { fulfillmentLabel } from "@/lib/admin-policy";
import { formatInrPaise } from "@/lib/money";
import { orderStatusLabel } from "@/lib/types/commerce";
import { advanceOrder } from "@/server/actions/admin";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Order | Admin" };

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
      shippingAddress: true,
    },
  });
  if (!order) notFound();

  const nextLabel = fulfillmentLabel(order.status);

  return (
    <div>
      <p className="text-sm text-stone-600">
        <Link href="/admin/orders" className="text-emerald-800 hover:underline">
          ← Orders
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Order
      </h1>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      <dl className="mt-6 grid gap-2 text-sm text-stone-700">
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Status</dt>
          <dd className="font-medium">{orderStatusLabel(order.status)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Customer</dt>
          <dd className="font-medium">
            {order.user.name ?? order.user.email} ({order.user.email})
          </dd>
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
          <dd className="font-medium">
            {order.invoiceNumber ?? "Assigned after payment"}
          </dd>
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
              {item.product.sku ? ` · ${item.product.sku}` : ""}
              {item.hsnSac ? ` · HSN ${item.hsnSac}` : ""}
            </span>
            <span>{formatInrPaise(item.qty * item.unitPaise)}</span>
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-stone-900">Ship to</h2>
        {order.shippingAddress ? (
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
            {order.shippingAddress.phone ? (
              <>
                <br />
                {order.shippingAddress.phone}
              </>
            ) : null}
            <br />
            {order.shippingAddress.country}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-600">No shipping address on this order.</p>
        )}
      </section>

      {nextLabel ? (
        <form action={advanceOrder} className="mt-8">
          <input type="hidden" name="orderId" value={order.id} />
          <button className={`${buttonClass} w-auto`} type="submit">
            {nextLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
