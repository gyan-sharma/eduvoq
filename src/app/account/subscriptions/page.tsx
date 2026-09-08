import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubscriptionStatus } from "@prisma/client";
import { successClass } from "@/components/auth/ui";
import { formatInrPaise } from "@/lib/money";
import { planGrantsWebinars } from "@/lib/entitlements";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscriptions | EduVoq",
};

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "Active";
    case SubscriptionStatus.EXPIRED:
      return "Expired";
    case SubscriptionStatus.CANCELED:
      return "Canceled";
    default:
      return status;
  }
}

export default async function AccountSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/subscriptions");

  const { paid } = await searchParams;
  const rows = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Subscriptions
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Display only. v1 packs are one-time orders, not recurring billing.
      </p>
      {paid ? (
        <p className={`${successClass} mt-4`}>
          Payment received. Your webinar pack should appear below once the
          webhook confirms.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">
          No packs yet.{" "}
          <Link href="/pricing" className="text-emerald-800 hover:underline">
            Buy the webinar pack
          </Link>{" "}
          (₹10 / 3 months, webinars only).
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-stone-200 bg-white p-5"
            >
              <p className="font-semibold text-stone-900">{row.plan.name}</p>
              <p className="mt-1 text-sm text-stone-600">
                {statusLabel(row.status)} · {formatInrPaise(row.plan.pricePaise)}{" "}
                one-time · valid through{" "}
                {row.currentPeriodEnd.toISOString().slice(0, 10)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {planGrantsWebinars(row.plan.entitlements)
                  ? "Unlocks webinars only — not the educator resource library."
                  : "No webinar entitlement on this plan."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
