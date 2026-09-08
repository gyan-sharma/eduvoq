import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { CartItemForm } from "@/components/store/cart-item-form";
import { formatInrPaise } from "@/lib/money";
import { MAX_CART_QTY } from "@/lib/types/commerce";
import {
  loadCart,
  productImagesByOwner,
  releaseExpiredPendingOrders,
} from "@/server/commerce";
import { isFlagEnabled } from "@/server/flags";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart | EduVoq",
};

export default async function CartPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/cart");

  await releaseExpiredPendingOrders();
  const [enabled, physical, cart] = await Promise.all([
    isFlagEnabled("commerce"),
    isFlagEnabled("commerce_physical"),
    loadCart(user.id),
  ]);
  const items = cart?.items ?? [];
  const images = await productImagesByOwner(items.map((item) => item.productId));
  const subtotal = items.reduce(
    (sum, item) => sum + item.qty * item.product.pricePaise,
    0,
  );
  const hasPhysical = items.some((item) => item.product.type === "PHYSICAL");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/store" className="text-emerald-800 hover:underline">
          ← Store
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Cart
      </h1>
      {!enabled ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The store is paused.
        </p>
      ) : null}
      {enabled && hasPhysical && !physical ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Physical shipping is paused. Checkout is unavailable until self-ship is
          re-enabled.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">
          Your cart is empty.{" "}
          <Link href="/store" className="text-emerald-800 hover:underline">
            Browse products
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {items.map((item) => {
            const imageId = images.get(item.productId);
            const maxQty =
              item.product.stock == null
                ? MAX_CART_QTY
                : Math.max(item.qty, Math.min(MAX_CART_QTY, item.product.stock));
            return (
              <li
                key={item.id}
                className="flex flex-wrap gap-4 rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-stone-100 text-xs text-stone-500">
                  {imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${imageId}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "SKU"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/store/products/${item.product.slug}`}
                    className="font-semibold text-stone-900 hover:text-emerald-800"
                  >
                    {item.product.name}
                  </Link>
                  <p className="mt-1 text-sm text-stone-600">
                    {formatInrPaise(item.product.pricePaise)} · SKU {item.product.sku}
                  </p>
                  <div className="mt-3">
                    <CartItemForm
                      productId={item.productId}
                      qty={item.qty}
                      maxQty={maxQty}
                    />
                  </div>
                </div>
                <p className="font-medium text-stone-900">
                  {formatInrPaise(item.qty * item.product.pricePaise)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold text-stone-900">
            Subtotal {formatInrPaise(subtotal)}
          </p>
          {enabled && !(hasPhysical && !physical) ? (
            <Link href="/checkout" className={`${buttonClass} w-auto`}>
              Checkout
            </Link>
          ) : (
            <span className={`${secondaryButtonClass} w-auto opacity-60`}>
              Checkout unavailable
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
