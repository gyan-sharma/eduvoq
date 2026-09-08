import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkCredentialsForm } from "@/components/auth/link-credentials-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/rbac";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await requireSession().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { provider: true },
  });
  const linked = new Set(accounts.map((row) => row.provider));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-sm text-stone-600">
        <Link href="/account" className="text-emerald-800 hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
        Settings
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Same-email social logins are not merged automatically. Sign in with the
        original method first, then link another provider here.
      </p>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">Linked logins</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          {user.passwordHash ? <li>Email and password</li> : null}
          {linked.has("google") ? <li>Google</li> : null}
          {linked.has("apple") ? <li>Apple</li> : null}
          {linked.has("facebook") ? <li>Facebook</li> : null}
          {linked.has("linkedin") ? <li>LinkedIn</li> : null}
          {!user.passwordHash && linked.size === 0 ? (
            <li>No extra providers yet</li>
          ) : null}
        </ul>
        <div className="mt-6">
          <SocialButtons callbackUrl="/account/settings" prefix="Link" />
        </div>
      </section>

      {!user.passwordHash ? (
        <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Add a password
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Lets you sign in with email as well as the social provider you
            started with.
          </p>
          <div className="mt-4">
            <LinkCredentialsForm />
          </div>
        </section>
      ) : null}
    </main>
  );
}
