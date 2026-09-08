"use client";

import { useActionState } from "react";
import { Role } from "@prisma/client";
import {
  requestAccountDeletion,
  updateSettings,
  type ProfileActionState,
} from "@/server/actions/profile";
import {
  buttonClass,
  errorClass,
  secondaryButtonClass,
  successClass,
} from "@/components/auth/ui";
import { canSetOwnProfilePublic, isDirectoryRole } from "@/lib/profile-privacy";

export function PrivacySettingsForm({
  isProfilePublic,
  role,
}: {
  isProfilePublic: boolean;
  role: Role;
}) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateSettings,
    null,
  );

  if (!canSetOwnProfilePublic(role)) return null;

  const listedInDirectory = isDirectoryRole(role);

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          className="mt-1"
          type="checkbox"
          name="isProfilePublic"
          defaultChecked={isProfilePublic}
        />
        <span>
          {listedInDirectory
            ? "List me in the public educators directory and show my profile at /members/username."
            : "Show my profile at /members/username. Parents are not listed in the educators directory."}
        </span>
      </label>
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save privacy"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    requestAccountDeletion,
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <p className="text-sm text-stone-600">
        Request deletion of personal data. An admin performs the hard-delete.
        Invoice records may be retained for Indian tax law. You can also write
        to hello@eduvoq.com.
      </p>
      <button
        className={secondaryButtonClass}
        type="submit"
        disabled={pending}
      >
        {pending ? "Sending…" : "Request account deletion"}
      </button>
    </form>
  );
}
