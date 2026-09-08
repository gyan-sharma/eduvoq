import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminFlash } from "@/components/admin/flash";
import { CmsPageForm } from "@/components/admin/cms-page-form";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Edit page | Admin" };

export default async function AdminEditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Edit {page.title}
      </h1>
      <div className="mt-4">
        <AdminFlash ok={ok} error={error} />
      </div>
      <div className="mt-6 max-w-2xl">
        <CmsPageForm page={page} />
      </div>
    </div>
  );
}
