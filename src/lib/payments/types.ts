import type { CheckoutGateway } from "@/lib/payments/gateway";

export type RazorpayClientCheckout = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  successPath: string;
};

export type CheckoutStart =
  | {
      gateway: "razorpay";
      razorpay: RazorpayClientCheckout;
    }
  | {
      gateway: "stripe";
      redirectUrl: string;
    }
  | {
      alreadyPaid: true;
      paymentId: string | null;
      returnPath: string;
    };

export function isAlreadyPaidCheckout(
  start: CheckoutStart,
): start is Extract<CheckoutStart, { alreadyPaid: true }> {
  return "alreadyPaid" in start && start.alreadyPaid;
}

export type { CheckoutGateway };
