import { DEFAULT_CHECKOUT_GATEWAY, type CheckoutGateway } from "@/lib/payments/gateway";

export function GatewayFields({
  defaultGateway = DEFAULT_CHECKOUT_GATEWAY,
}: {
  defaultGateway?: CheckoutGateway;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-stone-800">Payment method</legend>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          type="radio"
          name="gateway"
          value="razorpay"
          defaultChecked={defaultGateway === "razorpay"}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Razorpay (India)</span>
          <span className="block text-xs text-stone-500">
            UPI, netbanking, wallets, and Indian cards. Amounts in ₹ paise.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          type="radio"
          name="gateway"
          value="stripe"
          defaultChecked={defaultGateway === "stripe"}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Pay with card (international)</span>
          <span className="block text-xs text-stone-500">
            Stripe Checkout. Catalog stays INR paise — not a subscription.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
