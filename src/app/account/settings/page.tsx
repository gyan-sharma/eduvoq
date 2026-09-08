import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import {
  DeleteAccountForm,
  PrivacySettingsForm,
} from "@/components/account/privacy-settings-form";
import { ProfileForm } from "@/components/account/profile-form";
import { StudentProfileForm } from "@/components/account/student-profile-form";
import { LinkCredentialsForm } from "@/components/auth/link-credentials-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { toProfileFormUser } from "@/lib/types/user";
import { prisma } from "@/server/db";
import { getSessionUser } from "@/server/rbac";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { provider: true },
  });
  const linked = new Set(accounts.map((row) => row.provider));
  const isStudent = user.role === Role.STUDENT;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
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
        <h2 className="text-lg font-semibold text-stone-900">Profile</h2>
        <div className="mt-4">
          {isStudent ? (
            <StudentProfileForm user={toProfileFormUser(user)} />
          ) : (
            <ProfileForm user={toProfileFormUser(user)} />
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">Privacy</h2>
        <p className="mt-1 text-sm text-stone-600">
          {isStudent
            ? user.isProfilePublic
              ? "A parent opted this account into a first-name and grade card. You cannot change that here, and you still will not appear in the educators directory."
              : "Student accounts stay out of /members. Only a parent can opt in to a first-name and grade public card."
            : user.role === Role.PARENT
              ? "Parents are never listed in the educators directory. A public profile URL is optional and does not enroll you there."
              : "Public educator profiles appear at /members. Hide yours any time."}
        </p>
        <div className="mt-4">
          <PrivacySettingsForm
            isProfilePublic={user.isProfilePublic}
            role={user.role}
          />
        </div>
      </section>

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

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-stone-900">Your data</h2>
        <p className="mt-1 text-sm text-stone-600">
          Export or deletion is handled by staff. Email{" "}
          <a
            className="text-emerald-800 hover:underline"
            href="mailto:hello@eduvoq.com"
          >
            hello@eduvoq.com
          </a>{" "}
          or file a request below.
        </p>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/privacy" className="text-emerald-800 hover:underline">
            Privacy policy
          </Link>
        </p>
      </section>
    </div>
  );
}
