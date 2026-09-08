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
  title: "Learning material | EduVoq",
  description: "Educator learning material from Resource Corner.",
};

export default async function LearningMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; classLevel?: string; subject?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  const raw = await searchParams;
  const filters = parseResourceSearch(raw);
  const items = await listResources({
    kinds: [ResourceKind.LEARNING_MATERIAL, ResourceKind.SYLLABUS],
    viewer: user,
    ...filters,
  });

  return (
    <ResourcePageShell
      title="Learning material"
      description="Worksheets, syllabus extracts, and classroom resources. Files download only with an educator library entitlement."
      filterAction="/resources/learning-material"
      board={filters.board}
      classLevel={filters.classLevel}
      subject={filters.subject}
      items={items}
      canDownload={hasEducatorLibraryAccess(user)}
      canUpload={canUploadResource(user)}
      defaultKind={ResourceKind.LEARNING_MATERIAL}
      kindOptions={[ResourceKind.LEARNING_MATERIAL, ResourceKind.SYLLABUS]}
      empty="No learning material matches these filters yet."
    />
  );
}
