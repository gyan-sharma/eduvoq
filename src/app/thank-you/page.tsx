import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Thank you",
  description: "We received your message.",
};

export default function ThankYouPage() {
  return (
    <MarketingPage
      title="Thank you"
      description="We received your message and will reply to the email you gave us."
    >
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/about">About EduVoq</Link>
        </Button>
      </div>
    </MarketingPage>
  );
}
