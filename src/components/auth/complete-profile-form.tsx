"use client";

import { useActionState } from "react";
import { completeProfile, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, errorClass, fieldClass } from "@/components/auth/ui";

export function CompleteProfileForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    completeProfile,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <label className="block text-sm font-medium text-stone-700">
        Date of birth
        <input className={fieldClass} type="date" name="dateOfBirth" required />
      </label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input className="mt-1" type="checkbox" name="tos" required />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      <p className="text-xs text-stone-500">
        You must be 18 or older to activate this account. Under-18 learners need
        a parent to create their student profile.
      </p>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Complete profile"}
      </button>
    </form>
  );
}
