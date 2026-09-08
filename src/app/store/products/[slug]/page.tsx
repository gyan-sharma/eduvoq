import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductType } from "@prisma/client";
import { auth } from "@/auth";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";
import { AddToCartForm } from "@/components/store/add-to-cart-form";
import { formatInrPaise } from "@/lib/money";
import { jsonPlainText } from "@/lib/tiptap-text";
import { MAX_CART_QTY } from "@/lib/types/commerce";
import {
  catalogWhere,
  productImagesByOwner,
  releaseExpiredPendingOrders,
} from "@/server/commerce";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, ...catalogWhere },
    select: { name: true, descriptionJson: true },
  });
  if (!product) return { title: "Product" };
  return {
    title: `${product.name} | EduVoq`,
    description: jsonPlainText(product.descriptionJson).slice(0, 160),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  await releaseExpiredPendingOrders();
  const [product, enabled, physical, session] = await Promise.all([
    prisma.product.findFirst({ where: { slug, ...catalogWhere } }),
    isFlagEnabled("commerce"),
    isFlagEnabled("commerce_physical"),
    auth(),
  ]);
  if (!product) notFound();

  const images = await productImagesByOwner([product.id]);
  const imageId = images.get(product.id);
  const signedIn = Boolean(session?.user);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/store/products/${product.slug}`)}`;
  const maxQty =
    product.stock == null
      ? MAX_CART_QTY
      : Math.max(1, Math.min(MAX_CART_QTY, product.stock));
  const physicalBlocked =
    product.type === ProductType.PHYSICAL && !physical;

  let disabledReason: string | undefined;
  if (!enabled) disabledReason = "The store is paused.";
  else if (physicalBlocked) disabledReason = "Physical shipping is paused.";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/store" className="text-emerald-800 hover:underline">
          ← All products
        </Link>
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex aspect-[16/9] items-center justify-center bg-stone-100 text-sm text-stone-500">
          {imageId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${imageId}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            "Stationery"
          )}
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {product.name}
          </h1>
          <p className="mt-3 text-stone-600">
            {jsonPlainText(product.descriptionJson)}
          </p>
          <dl className="mt-6 grid gap-2 text-sm text-stone-700">
            <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
              <dt>Price</dt>
              <dd className="font-medium">{formatInrPaise(product.pricePaise)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
              <dt>SKU</dt>
              <dd className="font-medium">{product.sku}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
              <dt>Type</dt>
              <dd className="font-medium">
                {product.type === "PHYSICAL"
                  ? "Physical · self-ship India"
                  : "Digital"}
              </dd>
            </div>
            {product.stock != null ? (
              <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
                <dt>Stock</dt>
                <dd className="font-medium">{product.stock}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-8 grid gap-4">
            {signedIn ? (
              <AddToCartForm
                productId={product.id}
                maxQty={maxQty}
                disabled={Boolean(disabledReason)}
                disabledReason={disabledReason}
              />
            ) : (
              <Link href={loginHref} className={`${buttonClass} w-auto`}>
                Log in to add to cart
              </Link>
            )}
            <Link href="/store" className={`${secondaryButtonClass} w-auto`}>
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
