import { oauthSignIn } from "@/server/actions/auth";
import { secondaryButtonClass } from "@/components/auth/ui";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "facebook", label: "Continue with Facebook" },
  { id: "linkedin", label: "Continue with LinkedIn" },
] as const;

export function SocialButtons({
  callbackUrl,
  prefix = "Continue with",
}: {
  callbackUrl?: string;
  prefix?: string;
}) {
  const redirectTo = callbackUrl || "/account";
  return (
    <div className="grid gap-2">
      {PROVIDERS.map((provider) => (
        <form key={provider.id} action={oauthSignIn}>
          <input type="hidden" name="provider" value={provider.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className={secondaryButtonClass}>
            {prefix} {provider.label.replace("Continue with ", "")}
          </button>
        </form>
      ))}
    </div>
  );
}
