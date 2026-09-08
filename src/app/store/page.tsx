import type { Metadata } from "next";
import Link from "next/link";
import { formatInrPaise } from "@/lib/money";
import { jsonPlainText } from "@/lib/tiptap-text";
import { catalogWhere, productImagesByOwner } from "@/server/commerce";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store | EduVoq",
  description:
    "Stationery for educators and students: Student's Diary and Time-table Arrangement Register. India shipping only.",
};

export default async function StorePage() {
  const [enabled, physical, products] = await Promise.all([
    isFlagEnabled("commerce"),
    isFlagEnabled("commerce_physical"),
    prisma.product.findMany({
      where: catalogWhere,
      orderBy: { pricePaise: "asc" },
    }),
  ]);
  const images = await productImagesByOwner(products.map((product) => product.id));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
        Store
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        All products
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">
        Two stationery SKUs, self-shipped within India. Prepaid only — no cash
        on delivery. Metro shipping ₹79, rest of India ₹129.
      </p>
      {!enabled ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The store is paused. Email hello@eduvoq.com if you need to order.
        </p>
      ) : null}
      {enabled && !physical ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Physical shipping is paused. Catalog remains visible.
        </p>
      ) : null}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {products.map((product) => {
          const imageId = images.get(product.id);
          return (
            <li key={product.id}>
              <Link
                href={`/store/products/${product.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white hover:border-emerald-800"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-sm text-stone-500">
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
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-semibold text-stone-900">{product.name}</h2>
                  <p className="mt-2 flex-1 text-sm text-stone-600">
                    {jsonPlainText(product.descriptionJson)}
                  </p>
                  <p className="mt-4 text-lg font-semibold text-emerald-900">
                    {formatInrPaise(product.pricePaise)}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                    {product.type === "PHYSICAL" ? "Physical · India ship" : "Digital"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
