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
    };

export type { CheckoutGateway };
