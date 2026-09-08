import { PaymentKind, SubscriptionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@/lib/payments/crypto";
import {
  DEFAULT_CHECKOUT_GATEWAY,
  INR_CURRENCY,
  PAYMENT_HOLD_MS,
  formatInvoiceNumber,
  fromGatewayNotes,
  inrPaise,
  parseCheckoutGateway,
  toGatewayNotes,
} from "@/lib/payments/gateway";
import {
  parseRazorpayWebhook,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/razorpay";
import { isWebinarPackActive, planGrantsWebinars } from "@/lib/entitlements";
import { parseStripeCheckoutSession } from "@/lib/payments/stripe";
import { checkoutGatewaySchema } from "@/lib/validators/payments";

describe("checkout gateway picker", () => {
  it("defaults India checkout to Razorpay", () => {
    expect(DEFAULT_CHECKOUT_GATEWAY).toBe("razorpay");
    expect(parseCheckoutGateway(undefined)).toBe("razorpay");
    expect(parseCheckoutGateway("razorpay")).toBe("razorpay");
    expect(parseCheckoutGateway("stripe")).toBe("stripe");
    expect(checkoutGatewaySchema.parse(undefined)).toBe("razorpay");
    expect(checkoutGatewaySchema.parse("stripe")).toBe("stripe");
  });

  it("keeps catalog amounts in INR paise", () => {
    expect(inrPaise(1000)).toEqual({ amount: 1000, currency: INR_CURRENCY });
    expect(inrPaise(249900).amount).toBe(249900);
    expect(() => inrPaise(0)).toThrow(/paise/);
    expect(() => inrPaise(10.5)).toThrow(/paise/);
  });

  it("holds unpaid orders for 15 minutes", () => {
    expect(PAYMENT_HOLD_MS).toBe(15 * 60 * 1000);
  });
});

describe("invoice numbers", () => {
  it("formats EV-YYYY-#####", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("EV-2026-00001");
    expect(formatInvoiceNumber(2026, 42)).toBe("EV-2026-00042");
  });
});

describe("gateway notes", () => {
  it("round-trips order metadata", () => {
    const notes = toGatewayNotes({
      kind: PaymentKind.ORDER,
      userId: "user_1",
      orderId: "ord_1",
    });
    expect(fromGatewayNotes(notes)).toEqual({
      kind: PaymentKind.ORDER,
      userId: "user_1",
      orderId: "ord_1",
      bookingId: undefined,
      planId: undefined,
    });
  });
});

describe("Razorpay signatures and webhooks", () => {
  const secret = "whsec_test";

  it("accepts a valid webhook HMAC and rejects a bad one", () => {
    const body = `{"event":"payment.captured"}`;
    const signature = hmacSha256Hex(body, secret);
    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, "ab", secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, signature, "other")).toBe(false);
  });

  it("verifies Checkout.js order|payment signatures", () => {
    const orderId = "order_abc";
    const paymentId = "pay_def";
    const signature = hmacSha256Hex(`${orderId}|${paymentId}`, "key_secret");
    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature,
        keySecret: "key_secret",
      }),
    ).toBe(true);
    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature: hmacSha256Hex("nope", "key_secret"),
        keySecret: "key_secret",
      }),
    ).toBe(false);
  });

  it("parses payment.captured into a capture with stable event id", () => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_1",
            order_id: "order_1",
            amount: 1000,
            currency: "INR",
            notes: {
              kind: PaymentKind.PLAN_PACK,
              uid: "user_1",
              pid: "plan_1",
            },
          },
        },
      },
    });
    const capture = parseRazorpayWebhook(body, "evt_header_1");
    expect(capture?.providerEventId).toBe("evt_header_1");
    expect(capture?.amountPaise).toBe(1000);
    expect(capture?.meta).toEqual({
      kind: PaymentKind.PLAN_PACK,
      userId: "user_1",
      orderId: undefined,
      bookingId: undefined,
      planId: "plan_1",
    });
    expect(parseRazorpayWebhook(body, "evt_header_1")?.providerEventId).toBe(
      "evt_header_1",
    );
  });

  it("ignores unrelated Razorpay events", () => {
    expect(parseRazorpayWebhook(`{"event":"payment.failed"}`, null)).toBeNull();
  });
});

describe("Stripe checkout session parsing", () => {
  it("accepts mode=payment INR paise and rejects subscription mode", () => {
    const paid = parseStripeCheckoutSession({
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          payment_status: "paid",
          amount_total: 1000,
          currency: "inr",
          payment_intent: "pi_1",
          metadata: {
            kind: PaymentKind.ORDER,
            uid: "user_1",
            oid: "ord_1",
          },
        },
      },
    } as never);
    expect(paid?.amountPaise).toBe(1000);
    expect(paid?.currency).toBe("INR");
    expect(paid?.meta?.kind).toBe(PaymentKind.ORDER);

    expect(
      parseStripeCheckoutSession({
        id: "evt_sub",
        type: "checkout.session.completed",
        data: { object: { id: "cs_sub", mode: "subscription", payment_status: "paid" } },
      } as never),
    ).toBeNull();
  });
});

describe("webinar pack entitlements", () => {
  it("unlocks webinars only", () => {
    expect(planGrantsWebinars({ webinars: true })).toBe(true);
    expect(planGrantsWebinars({ webinars: true, resources: true })).toBe(true);
    expect(planGrantsWebinars({ resources: true })).toBe(false);
    expect(
      isWebinarPackActive({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        entitlements: { webinars: true },
      }),
    ).toBe(true);
    expect(
      isWebinarPackActive({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() - 1000),
        entitlements: { webinars: true },
      }),
    ).toBe(false);
  });
});
