"use client";

import { useActionState } from "react";
import {
  registerWithCredentials,
  type AuthActionState,
} from "@/server/actions/auth";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    registerWithCredentials,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <label className="block text-sm font-medium text-stone-700">
        Full name
        <input
          className={fieldClass}
          type="text"
          name="name"
          autoComplete="name"
          required
        />
      </label>
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
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Date of birth
        <input className={fieldClass} type="date" name="dateOfBirth" required />
      </label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input className="mt-1" type="checkbox" name="tos" required />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input className="mt-1" type="checkbox" name="isParent" />
        <span>I am a parent (I may create accounts for my children).</span>
      </label>
      <p className="text-xs text-stone-500">
        You must be 18 or older. Students cannot self-register — a parent creates
        the child account.
      </p>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
