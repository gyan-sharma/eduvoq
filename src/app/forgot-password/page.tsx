import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import {
  RequestResetForm,
  ResetPasswordForm,
} from "@/components/auth/forgot-password-forms";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard
      title={token ? "Choose a new password" : "Forgot password"}
      subtitle={
        token
          ? "This link expires one hour after it was sent."
          : "We will email a reset link if that address has a password login."
      }
    >
      {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
      <p className="mt-6 text-sm text-stone-600">
        <Link href="/login" className="font-medium text-emerald-800 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
