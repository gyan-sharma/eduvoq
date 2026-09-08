import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResourceKind } from "@prisma/client";
import { ResourcePageShell } from "@/components/resources/resource-page-shell";
import { canUploadResource, hasEducatorLibraryAccess } from "@/lib/entitlements";
import { parseResourceSearch } from "@/lib/resource-query";
import { requireSession } from "@/server/rbac";
import { listResources } from "@/server/resources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Class notes | EduVoq",
  description: "Class notes for school educators.",
};

export default async function ClassNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; classLevel?: string; subject?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  const raw = await searchParams;
  const filters = parseResourceSearch(raw);
  const items = await listResources({
    kinds: [ResourceKind.CLASS_NOTES],
    viewer: user,
    ...filters,
  });

  return (
    <ResourcePageShell
      title="Class notes"
      description="Teacher-contributed notes by board, class, and subject."
      filterAction="/resources/class-notes"
      board={filters.board}
      classLevel={filters.classLevel}
      subject={filters.subject}
      items={items}
      canDownload={hasEducatorLibraryAccess(user)}
      canUpload={canUploadResource(user)}
      defaultKind={ResourceKind.CLASS_NOTES}
      empty="No class notes match these filters yet."
    />
  );
}
