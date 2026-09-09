import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsBody } from "@/components/cms-body";
import { MarketingPage } from "@/components/marketing-page";
import { ServiceCtas } from "@/components/service-ctas";
import { serviceLinks } from "@/lib/nav";
import { serviceMedia } from "@/lib/service-media";
import { getCmsPage } from "@/server/cms";

export const dynamic = "force-dynamic";

const serviceSlugs = serviceLinks.map((item) =>
  item.href.replace(/^\/services\//, ""),
);

export function generateStaticParams() {
  return serviceSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(`services/${slug}`);
  if (!page) return {};
  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!serviceSlugs.includes(slug)) notFound();

  const page = await getCmsPage(`services/${slug}`);
  if (!page) notFound();

  const gallery =
    page.images.length > 0
      ? page.images
      : serviceMedia[slug]
        ? [serviceMedia[slug].src]
        : [];

  return (
    <MarketingPage title={page.title} images={gallery}>
      <CmsBody body={page.bodyJson} />
      <ServiceCtas />
    </MarketingPage>
  );
}
