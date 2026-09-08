"use client";

import { useActionState } from "react";
import { buttonClass, errorClass, fieldClass } from "@/components/auth/ui";
import { addToCart, type CommerceActionState } from "@/server/actions/commerce";

export function AddToCartForm({
  productId,
  maxQty,
  disabled,
  disabledReason,
}: {
  productId: string;
  maxQty: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    addToCart,
    null,
  );

  if (disabled) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {disabledReason ?? "This product cannot be added to the cart."}
      </p>
    );
  }

  return (
    <form action={action} className="grid max-w-xs gap-3">
      <input type="hidden" name="productId" value={productId} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <label className="block text-sm font-medium text-stone-700">
        Quantity
        <input
          className={fieldClass}
          type="number"
          name="qty"
          min={1}
          max={maxQty}
          defaultValue={1}
          required
        />
      </label>
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to cart"}
      </button>
    </form>
  );
}
