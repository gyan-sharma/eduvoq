import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { CmsBody } from "@/components/cms-body";
import { MarketingPage } from "@/components/marketing-page";
import { getCmsPage } from "@/server/cms";

export async function CmsDocument({
  slug,
  footer,
}: {
  slug: string;
  footer?: ReactNode;
}) {
  const page = await getCmsPage(slug);
  if (!page) notFound();

  return (
    <MarketingPage title={page.title} images={page.images}>
      <CmsBody body={page.bodyJson} />
      {footer}
    </MarketingPage>
  );
}
