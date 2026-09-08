"use client";

import { useActionState } from "react";
import {
  createChildStudent,
  type AuthActionState,
} from "@/server/actions/auth";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";

export function CreateChildForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    createChildStudent,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <label className="block text-sm font-medium text-stone-700">
        Child&apos;s name
        <input className={fieldClass} type="text" name="name" required />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Child&apos;s email
        <input className={fieldClass} type="email" name="email" required />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Password for the child
        <input
          className={fieldClass}
          type="password"
          name="password"
          minLength={8}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Child&apos;s date of birth
        <input className={fieldClass} type="date" name="dateOfBirth" required />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Your full name (attestation)
        <input className={fieldClass} type="text" name="parentFullName" required />
      </label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input className="mt-1" type="checkbox" name="attestation" required />
        <span>
          I am this child&apos;s parent or legal guardian and I consent to
          creating this EduVoq student account. This is an attestation, not
          verifiable identity check.
        </span>
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create student account"}
      </button>
    </form>
  );
}
