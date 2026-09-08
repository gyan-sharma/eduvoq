"use client";

import { useActionState } from "react";
import { linkCredentials, type AuthActionState } from "@/server/actions/auth";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";

export function LinkCredentialsForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    linkCredentials,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <label className="block text-sm font-medium text-stone-700">
        New password
        <input
          className={fieldClass}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add password"}
      </button>
    </form>
  );
}
