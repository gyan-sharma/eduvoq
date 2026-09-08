"use client";

import { useActionState } from "react";
import { errorClass } from "@/components/auth/ui";
import { deleteAddress, type CommerceActionState } from "@/server/actions/commerce";

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    deleteAddress,
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="addressId" value={addressId} />
      <button
        type="submit"
        className="text-sm text-stone-600 underline-offset-2 hover:underline disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error ? <p className={`${errorClass} mt-2`}>{state.error}</p> : null}
    </form>
  );
}
