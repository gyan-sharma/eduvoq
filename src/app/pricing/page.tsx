import type { Metadata } from "next";
import Link from "next/link";
import { UserStatus } from "@prisma/client";

import { MarketingPage } from "@/components/marketing-page";
import { BuyWebinarPackForm } from "@/components/payments/pay-form";
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
import { formatInrPaise } from "@/lib/money";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plans & Pricing",
  description:
    "Webinars and Guidance — ₹10 one-time pack, valid for 3 months.",
};

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
        interval: plan.interval,
      };
    }
  } catch {
    // Fall through to seed copy when MySQL is down.
  }
  return WEBINAR_PACK_FALLBACK;
}

export default async function PricingPage() {
  const pack = await getWebinarPack();
  const user = await requireSession().catch(() => null);
  const canBuy = user?.status === UserStatus.ACTIVE;

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
          <p className="text-xs text-muted-foreground">
            Charged once via Razorpay (India) or Stripe card (international). We
            do not create Razorpay Subscriptions or Stripe Billing cycles.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          {canBuy ? (
            <BuyWebinarPackForm />
          ) : (
            <Button asChild>
              <Link href="/login?callbackUrl=/pricing">Log in to buy</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </CardFooter>
      </Card>
    </MarketingPage>
  );
}
