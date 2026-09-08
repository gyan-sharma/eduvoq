import Link from "next/link";
import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { SocialButtons } from "@/components/auth/social-buttons";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.status === UserStatus.PENDING_PROFILE) {
    redirect("/complete-profile");
  }
  if (session?.user) {
    redirect("/account");
  }

  return (
    <AuthCard
      title="Join EduVoq"
      subtitle="A professional network for school teachers and K-12 stakeholders."
    >
      <RegisterForm />
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        or
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <SocialButtons />
      <p className="mt-6 text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-800 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
