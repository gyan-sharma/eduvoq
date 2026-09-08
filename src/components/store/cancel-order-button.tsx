"use client";

import { useActionState } from "react";
import { errorClass, secondaryButtonClass, successClass } from "@/components/auth/ui";
import {
  cancelPendingOrder,
  type CommerceActionState,
} from "@/server/actions/commerce";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    cancelPendingOrder,
    null,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <button
        className={`${secondaryButtonClass} w-auto`}
        type="submit"
        disabled={pending}
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
    </form>
  );
}
