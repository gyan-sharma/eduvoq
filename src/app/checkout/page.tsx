import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { CheckoutForm } from "@/components/store/checkout-form";
import { formatInrPaise } from "@/lib/money";
import {
  loadCart,
  loadShippingRates,
  releaseExpiredPendingOrders,
} from "@/server/commerce";
import { isFlagEnabled } from "@/server/flags";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | EduVoq",
};

export default async function CheckoutPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/checkout");
  if (user.status !== UserStatus.ACTIVE) redirect("/account");

  await releaseExpiredPendingOrders();
  const [enabled, physical, cart, rates, addresses] = await Promise.all([
    isFlagEnabled("commerce"),
    isFlagEnabled("commerce_physical"),
    loadCart(user.id),
    loadShippingRates(),
    prisma.address.findMany({
      where: { userId: user.id, country: "IN" },
      orderBy: { id: "desc" },
    }),
  ]);
  const items = cart?.items ?? [];
  if (items.length === 0) redirect("/cart");

  const hasPhysical = items.some((item) => item.product.type === "PHYSICAL");
  const subtotal = items.reduce(
    (sum, item) => sum + item.qty * item.product.pricePaise,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/cart" className="text-emerald-800 hover:underline">
          ← Cart
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Checkout
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        India addresses only. Prepaid. No cash on delivery. We self-ship from
        Delhi — metro {formatInrPaise(rates.metro)}, rest of India{" "}
        {formatInrPaise(rates.rest)}.
      </p>

      {!enabled || (hasPhysical && !physical) ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Checkout is paused. Your cart is saved.
        </p>
      ) : (
        <div className="mt-8 grid gap-8">
          <ul className="grid gap-2 text-sm text-stone-700">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.product.name} × {item.qty}
                </span>
                <span>{formatInrPaise(item.qty * item.product.pricePaise)}</span>
              </li>
            ))}
          </ul>
          <CheckoutForm
            addresses={addresses.map((row) => ({
              id: row.id,
              label: `${row.name}, ${row.line1}, ${row.city} ${row.postalCode}`,
              city: row.city,
              postalCode: row.postalCode,
            }))}
            subtotalPaise={subtotal}
            rates={rates}
            hasPhysical={hasPhysical}
          />
        </div>
      )}
    </main>
  );
}
