import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cmsPageBySlug } from "@/content/cms";
import { serviceGroups } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Services",
  description:
    "School-operations consulting landings from EduVoq — advisory for Indian K-12 schools.",
};

export default function ServicesIndexPage() {
  return (
    <MarketingPage
      title="School operations consulting"
      description="Advisory landings for Indian K-12 schools. These pages describe consulting topics, not software modules."
      className="max-w-5xl"
    >
      <div className="flex flex-col gap-10">
        {serviceGroups.map((group) => (
          <section key={group.heading}>
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {group.heading}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => {
                const slug = item.href.replace(/^\/services\//, "");
                const page = cmsPageBySlug[`services/${slug}`];
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="block h-full">
                      <Card className="h-full transition-colors hover:bg-muted/40">
                        <CardHeader>
                          <CardTitle>{item.label}</CardTitle>
                          {page?.seoDescription ? (
                            <CardDescription>
                              {page.seoDescription}
                            </CardDescription>
                          ) : null}
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </MarketingPage>
  );
}
