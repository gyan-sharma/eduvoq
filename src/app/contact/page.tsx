import type { Metadata } from "next";

import { CmsBody } from "@/components/cms-body";
import { ContactForm } from "@/components/contact-form";
import { MarketingPage } from "@/components/marketing-page";
import { CONTACT_EMAIL } from "@/lib/nav";
import { getTurnstileSiteKey } from "@/lib/turnstile";
import { getCmsPage } from "@/server/cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact EduVoq at ${CONTACT_EMAIL}.`,
};

export default async function ContactPage() {
  const siteKey = getTurnstileSiteKey();
  const page = await getCmsPage("contact");

  return (
    <MarketingPage
      title={page?.title ?? "Contact"}
      description="Questions about consulting, community, or EduVoq? Send a note — we read every message."
      images={page?.images}
    >
      {page ? <CmsBody body={page.bodyJson} /> : null}
      <p className="mt-6 text-base leading-7">
        Email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-primary hover:underline"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        or use the form below.
      </p>
      <div className="mt-8 max-w-md">
        <ContactForm siteKey={siteKey} />
      </div>
    </MarketingPage>
  );
}
