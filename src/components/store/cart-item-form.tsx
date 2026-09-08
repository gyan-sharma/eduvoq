"use client";

import { useActionState } from "react";
import { errorClass, fieldClass, secondaryButtonClass } from "@/components/auth/ui";
import { updateCart, type CommerceActionState } from "@/server/actions/commerce";

export function CartItemForm({
  productId,
  qty,
  maxQty,
}: {
  productId: string;
  qty: number;
  maxQty: number;
}) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    updateCart,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="block text-sm font-medium text-stone-700">
        Qty
        <input
          className={`${fieldClass} w-20`}
          type="number"
          name="qty"
          min={0}
          max={maxQty}
          defaultValue={qty}
          required
        />
      </label>
      <button
        className={`${secondaryButtonClass} w-auto`}
        type="submit"
        disabled={pending}
      >
        {pending ? "Updating…" : "Update"}
      </button>
      <button
        className="text-sm text-stone-600 underline-offset-2 hover:underline"
        type="submit"
        name="intent"
        value="remove"
        disabled={pending}
      >
        Remove
      </button>
      {state?.error ? <p className={`${errorClass} w-full`}>{state.error}</p> : null}
    </form>
  );
}
