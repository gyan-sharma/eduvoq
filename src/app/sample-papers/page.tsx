import type { Metadata } from "next";
import { ResourceKind } from "@prisma/client";
import { auth } from "@/auth";
import { ResourcePageShell } from "@/components/resources/resource-page-shell";
import { hasEducatorLibraryAccess } from "@/lib/entitlements";
import { parseResourceSearch } from "@/lib/resource-query";
import { prisma } from "@/server/db";
import { listResources } from "@/server/resources";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lesson Plans | EduVoq",
  description: "Sample Papers and Examination Guidance",
};

export default async function PublicSamplePapersPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; classLevel?: string; subject?: string }>;
}) {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  const raw = await searchParams;
  const filters = parseResourceSearch(raw);
  const items = await listResources({
    kinds: [ResourceKind.SAMPLE_PAPER, ResourceKind.LESSON_PLAN],
    publicOnly: true,
    ...filters,
  });

  const entitled = hasEducatorLibraryAccess(user);
  const loginHref = session?.user
    ? undefined
    : "/login?callbackUrl=/sample-papers";

  return (
    <ResourcePageShell
      title="Lesson plans"
      description="Sample papers and examination guidance. Titles, board, and class are public; downloading a file requires an active educator account."
      filterAction="/sample-papers"
      board={filters.board}
      classLevel={filters.classLevel}
      subject={filters.subject}
      items={items}
      canDownload={entitled}
      canUpload={false}
      loginHref={loginHref}
      empty="No published sample papers or lesson plans yet."
      teaser={
        entitled
          ? undefined
          : session?.user
            ? "Downloads require an active EDUCATOR, EXPERT, STAFF, or ADMIN account. The webinar pack does not unlock this library."
            : "Sign in to download. Resource Corner is for verified EDUCATOR / EXPERT / STAFF / ADMIN accounts — not the paid webinar pack."
      }
    />
  );
}
