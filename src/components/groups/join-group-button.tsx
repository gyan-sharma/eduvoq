"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  secondaryButtonClass,
} from "@/components/auth/ui";
import {
  joinGroup,
  leaveGroup,
  type GroupActionState,
} from "@/server/actions/groups";

export function JoinGroupButton({
  slug,
  isMember,
  canJoin,
  blockedReason,
}: {
  slug: string;
  isMember: boolean;
  canJoin: boolean;
  blockedReason?: string;
}) {
  const action = isMember ? leaveGroup : joinGroup;
  const [state, formAction, pending] = useActionState<
    GroupActionState,
    FormData
  >(action, null);

  if (!canJoin && !isMember) {
    return blockedReason ? (
      <p className="text-sm text-muted-foreground">{blockedReason}</p>
    ) : null;
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="slug" value={slug} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={`${isMember ? secondaryButtonClass : buttonClass} w-auto`}
      >
        {pending
          ? isMember
            ? "Leaving…"
            : "Joining…"
          : isMember
            ? "Leave group"
            : "Join group"}
      </button>
    </form>
  );
}
