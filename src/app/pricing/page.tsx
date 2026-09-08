import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing-page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WEBINAR_PACK_FALLBACK } from "@/content/cms";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans & Pricing",
  description:
    "Webinars and Guidance — ₹10 one-time pack, valid for 3 months.",
};

function formatInrPaise(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

async function getWebinarPack() {
  try {
    const plan = await prisma.plan.findUnique({
      where: { slug: WEBINAR_PACK_FALLBACK.slug },
    });
    if (plan) {
      return {
        name: plan.name,
        pricePaise: plan.pricePaise,
        durationMonths: plan.durationMonths,
        description: plan.description,
      };
    }
  } catch {
    // Fall through to seed copy when MySQL is down.
  }
  return WEBINAR_PACK_FALLBACK;
}

export default async function PricingPage() {
  const pack = await getWebinarPack();

  return (
    <MarketingPage
      title="Choose your pricing plan"
      description="Free accounts remain the default. The webinar pack is a one-time purchase, not a monthly subscription."
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{pack.name}</CardTitle>
          <CardDescription>
            One-time · valid {pack.durationMonths} months
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="font-heading text-4xl font-semibold tracking-tight">
            {formatInrPaise(pack.pricePaise)}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {pack.description}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button disabled title="Payments are not enabled yet">
            Buy Now
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </CardFooter>
      </Card>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Checkout is not wired in this release. Email us if you want the pack
        before online payments go live.
      </p>
    </MarketingPage>
  );
}
