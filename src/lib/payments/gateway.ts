import { PaymentKind, PaymentProvider } from "@prisma/client";

/** Catalog and both gateways settle in INR minor units (paise). */
export const INR_CURRENCY = "INR" as const;

export const CHECKOUT_GATEWAYS = ["razorpay", "stripe"] as const;
export type CheckoutGateway = (typeof CHECKOUT_GATEWAYS)[number];

/** India default. International card is an explicit Stripe opt-in. */
export const DEFAULT_CHECKOUT_GATEWAY: CheckoutGateway = "razorpay";

export const PAYMENT_HOLD_MS = 15 * 60 * 1000;

/** Stripe Checkout Sessions cannot expire sooner than 30 minutes. */
export const STRIPE_CHECKOUT_MIN_EXPIRE_MS = 30 * 60 * 1000;

export const WEBINAR_PLAN_SLUG = "webinars-guidance";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export function isCheckoutGateway(value: string | null | undefined): value is CheckoutGateway {
  return value === "razorpay" || value === "stripe";
}

export function parseCheckoutGateway(
  value: string | null | undefined,
): CheckoutGateway {
  return value === "stripe" ? "stripe" : DEFAULT_CHECKOUT_GATEWAY;
}

export function gatewayToProvider(gateway: CheckoutGateway): PaymentProvider {
  return gateway === "stripe" ? PaymentProvider.STRIPE : PaymentProvider.RAZORPAY;
}

export function inrPaise(amountPaise: number): {
  amount: number;
  currency: typeof INR_CURRENCY;
} {
  if (!Number.isInteger(amountPaise) || amountPaise < 1) {
    throw new PaymentError("Amount must be a positive integer in paise.");
  }
  return { amount: amountPaise, currency: INR_CURRENCY };
}

export function paymentHoldExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + PAYMENT_HOLD_MS);
}

export function stripeCheckoutExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + STRIPE_CHECKOUT_MIN_EXPIRE_MS);
}

export function isPaymentKind(value: string): value is PaymentKind {
  return (
    value === PaymentKind.ORDER ||
    value === PaymentKind.BOOKING ||
    value === PaymentKind.PLAN_PACK ||
    value === PaymentKind.WALLET_TOPUP ||
    value === PaymentKind.EVENT
  );
}

export type PaymentMeta = {
  kind: PaymentKind;
  userId: string;
  orderId?: string;
  bookingId?: string;
  planId?: string;
};

export function toGatewayNotes(meta: PaymentMeta): Record<string, string> {
  const notes: Record<string, string> = {
    kind: meta.kind,
    uid: meta.userId,
  };
  if (meta.orderId) notes.oid = meta.orderId;
  if (meta.bookingId) notes.bid = meta.bookingId;
  if (meta.planId) notes.pid = meta.planId;
  return notes;
}

export function mergeGatewayNotes(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && value.length > 0) merged[key] = value;
    }
  }
  return merged;
}

export function fromGatewayNotes(
  notes: Record<string, unknown> | null | undefined,
): PaymentMeta | null {
  if (!notes) return null;
  const kind = typeof notes.kind === "string" ? notes.kind : "";
  const userId = typeof notes.uid === "string" ? notes.uid : "";
  if (!isPaymentKind(kind) || !userId) return null;
  const orderId = typeof notes.oid === "string" && notes.oid ? notes.oid : undefined;
  const bookingId = typeof notes.bid === "string" && notes.bid ? notes.bid : undefined;
  const planId = typeof notes.pid === "string" && notes.pid ? notes.pid : undefined;
  return { kind, userId, orderId, bookingId, planId };
}

export function gatewayKindFromId(
  id: string | null | undefined,
): CheckoutGateway | null {
  if (!id) return null;
  if (id.startsWith("cs_")) return "stripe";
  if (id.startsWith("order_")) return "razorpay";
  return null;
}

export function captureEventId(paymentId: string, fallback: string): string {
  return paymentId ? `pay:${paymentId}` : fallback;
}

export function sameGatewayPaymentId(
  stored: string | null | undefined,
  incoming: string,
): boolean {
  if (!stored) return true;
  return stored === incoming;
}

export function formatInvoiceNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(seq) || seq < 1) {
    throw new PaymentError("Invalid invoice sequence.");
  }
  return `EV-${year}-${String(seq).padStart(5, "0")}`;
}

export function invoiceYear(now = new Date()): number {
  return now.getUTCFullYear();
}

export function addUtcMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
