"use client";

import { useActionState, useMemo, useState } from "react";
import { buttonClass, errorClass, fieldClass } from "@/components/auth/ui";
import { AddressFields } from "@/components/store/address-fields";
import { formatInrPaise } from "@/lib/money";
import { shippingBand, shippingPaiseForBand } from "@/lib/shipping";
import { GST_TAX_PAISE } from "@/lib/types/commerce";
import { placeOrder, type CommerceActionState } from "@/server/actions/commerce";

export type CheckoutAddressOption = {
  id: string;
  label: string;
  city: string;
  postalCode: string;
};

export function CheckoutForm({
  addresses,
  subtotalPaise,
  rates,
  hasPhysical,
}: {
  addresses: CheckoutAddressOption[];
  subtotalPaise: number;
  rates: { metro: number; rest: number };
  hasPhysical: boolean;
}) {
  const [state, action, pending] = useActionState<CommerceActionState, FormData>(
    placeOrder,
    null,
  );
  const [mode, setMode] = useState<"saved" | "new">(
    addresses.length > 0 ? "saved" : "new",
  );
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const shippingPaise = useMemo(() => {
    if (!hasPhysical) return 0;
    if (mode === "saved") {
      const selected = addresses.find((row) => row.id === addressId);
      if (!selected) return rates.rest;
      const band = shippingBand({
        city: selected.city,
        postalCode: selected.postalCode,
      });
      return shippingPaiseForBand(band, rates);
    }
    if (!city && !postalCode) return rates.rest;
    const band = shippingBand({ city, postalCode });
    return shippingPaiseForBand(band, rates);
  }, [addressId, addresses, city, hasPhysical, mode, postalCode, rates]);

  const taxPaise = GST_TAX_PAISE;
  const totalPaise = subtotalPaise + taxPaise + shippingPaise;
  const bandLabel =
    hasPhysical && shippingPaise === rates.metro
      ? "Metro"
      : hasPhysical
        ? "Rest of India"
        : "None";

  return (
    <form action={action} className="grid gap-6">
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}

      {hasPhysical ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-stone-800">
            Shipping address (India)
          </legend>
          {addresses.length > 0 ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="addressMode"
                  checked={mode === "saved"}
                  onChange={() => setMode("saved")}
                />
                Saved address
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="addressMode"
                  checked={mode === "new"}
                  onChange={() => setMode("new")}
                />
                New address
              </label>
            </div>
          ) : null}

          {mode === "saved" && addresses.length > 0 ? (
            <label className="block text-sm font-medium text-stone-700">
              Address
              <select
                className={fieldClass}
                name="addressId"
                value={addressId}
                onChange={(event) => setAddressId(event.target.value)}
                required
              >
                {addresses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div
              onChange={(event) => {
                const target = event.target as HTMLInputElement;
                if (target.name === "city") setCity(target.value);
                if (target.name === "postalCode") setPostalCode(target.value);
              }}
            >
              <AddressFields />
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-stone-600">No shipping required.</p>
      )}

      <label className="block text-sm font-medium text-stone-700">
        GSTIN (optional)
        <input
          className={fieldClass}
          name="buyerGstin"
          maxLength={15}
          autoCapitalize="characters"
          placeholder="For your tax invoice later"
        />
      </label>

      <dl className="grid gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="font-medium">{formatInrPaise(subtotalPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>GST</dt>
          <dd className="font-medium">{formatInrPaise(taxPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Shipping ({bandLabel})</dt>
          <dd className="font-medium">{formatInrPaise(shippingPaise)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 text-base text-stone-900">
          <dt>Total</dt>
          <dd className="font-semibold">{formatInrPaise(totalPaise)}</dd>
        </div>
      </dl>

      <p className="text-sm text-stone-600">
        Prepaid only — no cash on delivery. Self-ship within India (metro{" "}
        {formatInrPaise(rates.metro)} / rest of India {formatInrPaise(rates.rest)}
        ). GST is ₹0 until EduVoq’s GSTIN is registered. Payment checkout arrives
        in the next release; this order stays pending payment for 15 minutes.
      </p>

      <button className={`${buttonClass} w-auto justify-self-start`} type="submit" disabled={pending}>
        {pending ? "Placing order…" : "Place prepaid order"}
      </button>
    </form>
  );
}
