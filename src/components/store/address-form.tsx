"use client";

import { useActionState } from "react";
import { buttonClass, errorClass, successClass } from "@/components/auth/ui";
import { AddressFields } from "@/components/store/address-fields";
import { saveAddress, type CommerceActionState } from "@/server/actions/commerce";

export function AddressForm({
  addressId,
  defaultValues,
}: {
  addressId?: string;
  defaultValues?: {
    name?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string | null;
  };
}) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    saveAddress,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {addressId ? <input type="hidden" name="addressId" value={addressId} /> : null}
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <AddressFields defaultValues={defaultValues} />
      <button className={`${buttonClass} w-auto justify-self-start`} type="submit" disabled={pending}>
        {pending ? "Saving…" : addressId ? "Update address" : "Save address"}
      </button>
    </form>
  );
}
