"use client";

import { useActionState } from "react";
import { loginWithCredentials, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, errorClass, fieldClass } from "@/components/auth/ui";

export function LoginForm({
  callbackUrl,
}: {
  callbackUrl?: string;
}) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    loginWithCredentials,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl || "/account"} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <label className="block text-sm font-medium text-stone-700">
        Email
        <input
          className={fieldClass}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Password
        <input
          className={fieldClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
