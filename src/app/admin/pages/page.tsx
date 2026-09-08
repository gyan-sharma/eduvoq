import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/auth/ui";
import { cmsPublicPath } from "@/lib/admin-policy";
import { listCmsPagesForAdmin } from "@/server/cms";

export const metadata: Metadata = { title: "Pages | Admin" };

export default async function AdminPagesPage() {
  const pages = await listCmsPagesForAdmin();
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            CMS pages
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            TipTap editor for About, legal, and service landings.
          </p>
        </div>
        <Link href="/admin/pages/new" className={`${buttonClass} w-auto`}>
          New page
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {pages.map((page) => (
          <li key={page.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link
                href={`/admin/pages/${page.id}`}
                className="font-medium text-stone-900 hover:underline"
              >
                {page.title}
              </Link>
              <p className="text-sm text-stone-600">
                {cmsPublicPath(page.slug)} ·{" "}
                {page.published ? "Published" : "Unpublished"}
              </p>
            </div>
            <Link
              href={cmsPublicPath(page.slug)}
              className="text-sm text-emerald-800 hover:underline"
            >
              View
            </Link>
          </li>
        ))}
      </ul>
      {pages.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No CMS pages in the database yet.</p>
      ) : null}
    </div>
  );
}
