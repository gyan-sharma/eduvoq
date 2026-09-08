import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressForm } from "@/components/store/address-form";
import { DeleteAddressButton } from "@/components/store/delete-address-button";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Addresses | EduVoq",
};

export default async function AccountAddressesPage() {
  const user = await requireSession().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/account/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: { id: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Addresses
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        India only. These addresses are used for self-ship stationery orders.
      </p>

      {addresses.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No saved addresses yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="rounded-xl border border-stone-200 bg-white p-5"
            >
              <p className="font-medium text-stone-900">{address.name}</p>
              <p className="mt-1 text-sm text-stone-600">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country === "IN" ? "India" : address.country}
                {address.phone ? ` · ${address.phone}` : ""}
              </p>
              <div className="mt-4">
                <DeleteAddressButton addressId={address.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">Add address</h2>
        <div className="mt-4">
          <AddressForm />
        </div>
      </section>
    </div>
  );
}
