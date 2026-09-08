import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { AuthCard } from "@/components/auth/auth-card";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { signOutAction } from "@/server/actions/auth";
import { requireSession } from "@/server/rbac";
import { secondaryButtonClass } from "@/components/auth/ui";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const user = await requireSession().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  if (user.status !== UserStatus.PENDING_PROFILE) {
    redirect("/account");
  }

  return (
    <AuthCard
      title="Complete your profile"
      subtitle="Social sign-in still needs your date of birth and agreement to the terms before the account is activated."
    >
      <CompleteProfileForm />
      <form action={signOutAction} className="mt-6">
        <button type="submit" className={secondaryButtonClass}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
