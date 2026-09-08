import Link from "next/link";
import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { errorClass } from "@/components/auth/ui";

export const dynamic = "force-dynamic";

function loginErrorMessage(error?: string): string | null {
  if (!error) return null;
  if (error === "LinkRequired" || error === "OAuthAccountNotLinked") {
    return "An account with this email already exists. Sign in with your original method first, then link this login from Account settings.";
  }
  if (error === "CredentialsSignin") {
    return "Invalid email or password, or the account is not yet verified.";
  }
  if (error === "AccessDenied") {
    return "Sign-in was denied.";
  }
  if (error === "Configuration") {
    return "This sign-in method is not configured.";
  }
  if (error === "NeedParent") {
    return "You must be 18 or older to create an account. Ask a parent to create your account.";
  }
  return "Unable to sign in.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user?.status === UserStatus.PENDING_PROFILE) {
    redirect("/complete-profile");
  }
  if (session?.user) {
    redirect("/account");
  }

  const params = await searchParams;
  const message = loginErrorMessage(params.error);

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back to EduVoq — Connecting Educators."
    >
      {message ? <p className={`${errorClass} mb-4`}>{message}</p> : null}
      <LoginForm callbackUrl={params.callbackUrl} />
      <p className="mt-3 text-sm text-stone-600">
        <Link href="/forgot-password" className="text-emerald-800 hover:underline">
          Forgot password?
        </Link>
      </p>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        or
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <SocialButtons callbackUrl={params.callbackUrl} />
      <p className="mt-6 text-sm text-stone-600">
        New here?{" "}
        <Link href="/register" className="font-medium text-emerald-800 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
