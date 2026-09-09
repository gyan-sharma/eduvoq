"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { createGroup, type GroupActionState } from "@/server/actions/groups";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState<GroupActionState, FormData>(
    createGroup,
    null,
  );

  return (
    <form
      action={action}
      className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-heading text-lg font-semibold">Start a group</h2>
      <p className="text-sm text-muted-foreground">
        Educators create teacher groups. Students create Student Circle groups.
        There is no private inbox.
      </p>
      <label className="text-sm font-medium text-foreground">
        Name
        <input
          className={fieldClass}
          name="name"
          required
          minLength={3}
          maxLength={80}
          placeholder="Class 8 science circle"
        />
      </label>
      <label className="text-sm font-medium text-foreground">
        Description (optional)
        <textarea
          className={`${fieldClass} min-h-20`}
          name="description"
          maxLength={500}
          rows={3}
        />
      </label>
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <div className="flex justify-end">
        <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}
