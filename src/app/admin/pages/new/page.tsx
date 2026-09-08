import type { Metadata } from "next";

import { CmsPageForm } from "@/components/admin/cms-page-form";

export const metadata: Metadata = { title: "New page | Admin" };

export default function AdminNewPagePage() {
  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        New CMS page
      </h1>
      <div className="mt-6 max-w-2xl">
        <CmsPageForm />
      </div>
    </main>
  );
}
