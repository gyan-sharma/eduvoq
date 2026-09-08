import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { errorClass } from "@/components/auth/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join",
  description: "Create an EduVoq account. You must be 18 or older.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.status === UserStatus.PENDING_PROFILE) {
    redirect("/complete-profile");
  }
  if (session?.user) {
    redirect("/account");
  }

  const { error } = await searchParams;
  const parentMessage =
    error === "NeedParent"
      ? "You must be 18 or older to create an account. Ask a parent to create your account."
      : null;

  return (
    <AuthCard
      title="Join EduVoq"
      subtitle="A professional network for school teachers and K-12 stakeholders."
    >
      {parentMessage ? (
        <p className={`${errorClass} mb-4`}>{parentMessage}</p>
      ) : null}
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
