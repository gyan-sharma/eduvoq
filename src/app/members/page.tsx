import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { Button } from "@/components/ui/button";
import { SITE_DESCRIPTION, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Educators",
  description: "Community Members — EduVoq. A professional network for school teachers.",
  alternates: { canonical: "/members" },
  openGraph: {
    title: "Educators | EduVoq",
    description:
      "Community Members — EduVoq. A professional network for school teachers.",
    url: absoluteUrl("/members"),
    type: "website",
  },
};

export default function MembersPage() {
  return (
    <MarketingPage
      title="Community Members"
      description="A professional network for school teachers and K-12 stakeholders. Educators are at the centre; parents and students are welcome for consultations."
    >
      <p className="text-muted-foreground">{SITE_DESCRIPTION}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/register">Join EduVoq</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </MarketingPage>
  );
}
