import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { CreateChildForm } from "@/components/auth/create-child-form";
import { signOutAction } from "@/server/actions/auth";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireSession().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  const children =
    user.role === Role.PARENT
      ? await prisma.user.findMany({
          where: { parentId: user.id },
          select: { id: true, name: true, username: true, email: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        My account
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Signed in as {user.email}
        {user.username ? ` (@${user.username})` : ""}.
      </p>
      <dl className="mt-6 grid gap-2 text-sm text-stone-700">
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Role</dt>
          <dd className="font-medium">{user.role}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-stone-200 py-2">
          <dt>Status</dt>
          <dd className="font-medium">{user.status}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/store" className={`${buttonClass} w-auto`}>
          Store
        </Link>
        <Link href="/account/orders" className={`${secondaryButtonClass} w-auto`}>
          Orders
        </Link>
        <Link href="/account/addresses" className={`${secondaryButtonClass} w-auto`}>
          Addresses
        </Link>
        <Link href="/resources" className={`${secondaryButtonClass} w-auto`}>
          Resource Corner
        </Link>
        <Link href="/account/settings" className={`${secondaryButtonClass} w-auto`}>
          Account settings
        </Link>
        {user.role === Role.STAFF || user.role === Role.ADMIN ? (
          <Link href="/admin" className={`${secondaryButtonClass} w-auto`}>
            Admin
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className={`${secondaryButtonClass} w-auto`}>
            Sign out
          </button>
        </form>
      </div>

      {user.role === Role.PARENT ? (
        <section className="mt-10 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-stone-900">Children</h2>
          <p className="mt-1 text-sm text-stone-600">
            Student self-registration is off. Create a child STUDENT account
            here. Parental attestation records your name, time, and IP — it is
            not verifiable DPDP consent.
          </p>
          {children.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-700">
              {children.map((child) => (
                <li key={child.id}>
                  {child.name} ({child.email}
                  {child.username ? ` · @${child.username}` : ""})
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6">
            <CreateChildForm />
          </div>
        </section>
      ) : null}
    </main>
  );
}
