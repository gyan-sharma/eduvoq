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
  title: "Sample papers | EduVoq",
  description: "Sample papers and lesson plans for school educators.",
};

export default async function MemberSamplePapersPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; classLevel?: string; subject?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login");

  const raw = await searchParams;
  const filters = parseResourceSearch(raw);
  const items = await listResources({
    kinds: [ResourceKind.SAMPLE_PAPER, ResourceKind.LESSON_PLAN],
    viewer: user,
    ...filters,
  });

  return (
    <ResourcePageShell
      title="Sample papers & lesson plans"
      description="Examination guidance and lesson plans. The public teaser listing is at /sample-papers; file downloads still require login and entitlement."
      filterAction="/resources/sample-papers"
      board={filters.board}
      classLevel={filters.classLevel}
      subject={filters.subject}
      items={items}
      canDownload={hasEducatorLibraryAccess(user)}
      canUpload={canUploadResource(user)}
      defaultKind={ResourceKind.SAMPLE_PAPER}
      kindOptions={[ResourceKind.SAMPLE_PAPER, ResourceKind.LESSON_PLAN]}
      empty="No sample papers or lesson plans match these filters yet."
    />
  );
}
