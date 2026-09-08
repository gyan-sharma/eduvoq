import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { errorClass, successClass } from "@/components/auth/ui";
import { verifyEmailToken } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : null;

  return (
    <AuthCard
      title="Verify email"
      subtitle="Confirm the address you used to join EduVoq."
    >
      {!token ? (
        <p className="text-sm text-stone-600">
          Check your inbox for a verification link. Locally the link is also
          written to the server log and Mailpit (port 8025).
        </p>
      ) : null}
      {result?.error ? <p className={errorClass}>{result.error}</p> : null}
      {result?.ok && result.message ? (
        <p className={successClass}>{result.message}</p>
      ) : null}
      <p className="mt-6 text-sm text-stone-600">
        <Link href="/login" className="font-medium text-emerald-800 hover:underline">
          Continue to log in
        </Link>
      </p>
    </AuthCard>
  );
}
