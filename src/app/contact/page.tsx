import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { MarketingPage } from "@/components/marketing-page";
import { CONTACT_EMAIL } from "@/lib/nav";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact EduVoq at ${CONTACT_EMAIL}.`,
};

export default function ContactPage() {
  const siteKey = getTurnstileSiteKey();

  return (
    <MarketingPage
      title="Contact"
      description="Questions about consulting, community, or EduVoq? Send a note — we read every message."
    >
      <p className="text-base leading-7">
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
