"use client";

import { useActionState } from "react";
import { buttonClass, errorClass } from "@/components/auth/ui";
import { GatewayFields } from "@/components/payments/gateway-fields";
import { RazorpayAutoOpen } from "@/components/payments/razorpay-checkout";
import {
  buyWebinarPack,
  startBookingPayment,
  startOrderPayment,
  type PaymentActionState,
} from "@/server/actions/payments";

function PayShell({
  action,
  hidden,
  label,
  pendingLabel,
}: {
  action: (state: PaymentActionState, formData: FormData) => Promise<PaymentActionState>;
  hidden: Record<string, string>;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState<PaymentActionState, FormData>(
    action,
    null,
  );
  return (
    <form action={formAction} className="grid gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <GatewayFields />
      <button className={`${buttonClass} w-auto justify-self-start`} type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      <RazorpayAutoOpen payload={state?.razorpay} />
    </form>
  );
}

export function PayOrderForm({ orderId }: { orderId: string }) {
  return (
    <PayShell
      action={startOrderPayment}
      hidden={{ orderId }}
      label="Pay now"
      pendingLabel="Starting checkout…"
    />
  );
}

export function PayBookingForm({ bookingId }: { bookingId: string }) {
  return (
    <PayShell
      action={startBookingPayment}
      hidden={{ bookingId }}
      label="Pay now"
      pendingLabel="Starting checkout…"
    />
  );
}

export function BuyWebinarPackForm() {
  return (
    <PayShell
      action={buyWebinarPack}
      hidden={{}}
      label="Buy one-time pack"
      pendingLabel="Starting checkout…"
    />
  );
}
