"use client";

import { useActionState } from "react";

import { buttonClass, errorClass, successClass } from "@/components/auth/ui";
import {
  registerForEvent,
  type EventActionState,
} from "@/server/actions/events";

export function EventRegisterForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<EventActionState, FormData>(
    registerForEvent,
    null,
  );

  if (state?.ok) {
    return <p className={successClass}>{state.message ?? "You are registered."}</p>;
  }

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
