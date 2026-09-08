import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireStaffPage } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:flex-row">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
