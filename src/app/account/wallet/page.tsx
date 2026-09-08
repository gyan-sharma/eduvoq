import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInrPaise } from "@/lib/money";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wallet | EduVoq",
};

export default async function AccountWalletPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/wallet");

  const [account, spendEnabled] = await Promise.all([
    prisma.walletAccount.findUnique({
      where: { userId: user.id },
      include: {
        ledger: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
    isFlagEnabled("wallet_spend"),
  ]);
  const balancePaise = account?.balancePaise ?? 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Wallet
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Display only. Wallet spend is {spendEnabled ? "on" : "off"} for v1.
      </p>

      <dl className="mt-6 grid gap-2 text-sm text-stone-700">
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Balance</dt>
          <dd className="font-medium">{formatInrPaise(balancePaise)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-stone-600">
        Top-up and spending are not available in this release. Prepaid store
        orders, bookings, and the webinar pack use Razorpay or Stripe.
      </p>

      {account?.ledger.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">Ledger</h2>
          <ul className="mt-3 grid gap-2 text-sm text-stone-700">
            {account.ledger.map((row) => (
              <li key={row.id} className="flex justify-between gap-4">
                <span>
                  {row.reason} · {row.createdAt.toISOString().slice(0, 10)}
                </span>
                <span className="font-medium">
                  {row.deltaPaise > 0 ? "+" : ""}
                  {formatInrPaise(row.deltaPaise)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-sm text-stone-500">No wallet movements yet.</p>
      )}
    </main>
  );
}
