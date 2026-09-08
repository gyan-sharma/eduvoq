"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass, errorClass, fieldClass, successClass } from "@/components/auth/ui";
import { GatewayFields } from "@/components/payments/gateway-fields";
import { RazorpayAutoOpen } from "@/components/payments/razorpay-checkout";
import { formatKolkataDate, formatKolkataTime, kolkataDateKey } from "@/lib/kolkata";
import { createBooking, type BookingActionState } from "@/server/actions/booking";
import type { PublicSlot } from "@/lib/types/booking";

export function BookForm({
  serviceSlug,
  slots,
}: {
  serviceSlug: string;
  slots: PublicSlot[];
}) {
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    createBooking,
    null,
  );
  const [selected, setSelected] = useState(slots[0]?.startsAt ?? "");

  const grouped = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const slot of slots) {
      const key = kolkataDateKey(new Date(slot.startsAt));
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    return [...map.entries()];
  }, [slots]);

  if (slots.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
        No open times in the next two weeks. Experts publish Asia/Kolkata hours;
        check back soon or write to hello@eduvoq.com.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="serviceSlug" value={serviceSlug} />
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}

      <fieldset className="grid gap-4">
        <legend className="text-sm font-medium text-stone-800">
          Choose a slot (IST)
        </legend>
        {grouped.map(([dayKey, daySlots]) => {
          const label = formatKolkataDate(new Date(daySlots[0].startsAt));
          return (
            <div key={dayKey} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-stone-900">{label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const id = `slot-${slot.startsAt}`;
                  return (
                    <label
                      key={slot.startsAt}
                      htmlFor={id}
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                        selected === slot.startsAt
                          ? "border-emerald-800 bg-emerald-50 text-emerald-950"
                          : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
                      }`}
                    >
                      <input
                        id={id}
                        className="sr-only"
                        type="radio"
                        name="startsAt"
                        value={slot.startsAt}
                        checked={selected === slot.startsAt}
                        onChange={() => setSelected(slot.startsAt)}
                        required
                      />
                      {formatKolkataTime(new Date(slot.startsAt))}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </fieldset>

      <label className="block text-sm font-medium text-stone-700">
        Notes for the expert (optional)
        <textarea
          className={fieldClass}
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Board, class, or questions you want to cover."
        />
      </label>

      <GatewayFields />

      <button className={`${buttonClass} w-auto justify-self-start`} type="submit" disabled={pending}>
        {pending ? "Holding slot…" : "Hold slot and pay"}
      </button>
      {state?.bookingId ? (
        <p className={successClass}>
          Slot held for 15 minutes.{" "}
          <Link href="/account/bookings" className="underline">
            Open My bookings
          </Link>{" "}
          if the payment window closed.
        </p>
      ) : null}
      <p className="text-xs text-stone-500">
        Prepaid only. Unpaid holds expire after 15 minutes and free the slot.
      </p>
      <RazorpayAutoOpen payload={state?.razorpay} />
    </form>
  );
}
