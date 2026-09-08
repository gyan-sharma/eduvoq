import { PaymentKind } from "@prisma/client";
import { razorpayConfig, razorpayCheckoutReady } from "@/lib/payments/config";
import { hmacSha256Hex, safeEqualHex } from "@/lib/payments/crypto";
import {
  INR_CURRENCY,
  PaymentError,
  fromGatewayNotes,
  inrPaise,
  toGatewayNotes,
  type PaymentMeta,
} from "@/lib/payments/gateway";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
  notes: Record<string, string>;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  notes: Record<string, string>;
};

export type RazorpayWebhookEvent = {
  event: string;
  payload?: {
    payment?: { entity?: Partial<RazorpayPayment> & Record<string, unknown> };
    order?: { entity?: Partial<RazorpayOrder> & Record<string, unknown> };
  };
  created_at?: number;
};

export type RazorpayCapture = {
  providerEventId: string;
  paymentId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  meta: PaymentMeta | null;
  payload: RazorpayWebhookEvent;
};

function authHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function asStringNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret = razorpayConfig().webhookSecret,
): boolean {
  if (!secret || !signature) return false;
  const expected = hmacSha256Hex(rawBody, secret);
  return safeEqualHex(expected, signature);
}

/** Checkout.js success callback: HMAC_SHA256(orderId|paymentId, key_secret). */
export function verifyRazorpayCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret?: string;
}): boolean {
  const secret = args.keySecret ?? razorpayConfig().keySecret;
  if (!secret || !args.orderId || !args.paymentId || !args.signature) return false;
  const expected = hmacSha256Hex(`${args.orderId}|${args.paymentId}`, secret);
  return safeEqualHex(expected, args.signature);
}

export async function createRazorpayOrder(args: {
  amountPaise: number;
  receipt: string;
  meta: PaymentMeta;
}): Promise<RazorpayOrder> {
  const config = razorpayConfig();
  if (!razorpayCheckoutReady(config)) {
    throw new PaymentError("India payments (Razorpay) are not configured.");
  }
  const money = inrPaise(args.amountPaise);
  // One-time Orders API only. Do not call /v1/subscriptions.
  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config.keyId, config.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: money.amount,
      currency: money.currency,
      receipt: args.receipt.slice(0, 40),
      payment_capture: 1,
      notes: toGatewayNotes(args.meta),
    }),
  });
  const json = (await response.json()) as RazorpayOrder & { error?: { description?: string } };
  if (!response.ok || !json.id) {
    throw new PaymentError(json.error?.description ?? "Unable to start Razorpay checkout.");
  }
  return {
    id: json.id,
    amount: Number(json.amount),
    currency: json.currency || INR_CURRENCY,
    receipt: json.receipt ?? null,
    status: json.status,
    notes: asStringNotes(json.notes),
  };
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const config = razorpayConfig();
  if (!razorpayCheckoutReady(config)) {
    throw new PaymentError("India payments (Razorpay) are not configured.");
  }
  const response = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader(config.keyId, config.keySecret) },
  });
  const json = (await response.json()) as RazorpayPayment & { error?: { description?: string } };
  if (!response.ok || !json.id) {
    throw new PaymentError(json.error?.description ?? "Unable to load Razorpay payment.");
  }
  return {
    id: json.id,
    order_id: json.order_id,
    amount: Number(json.amount),
    currency: json.currency || INR_CURRENCY,
    status: json.status,
    notes: asStringNotes(json.notes),
  };
}

export function parseRazorpayWebhook(
  rawBody: string,
  eventIdHeader: string | null,
): RazorpayCapture | null {
  let parsed: RazorpayWebhookEvent;
  try {
    parsed = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return null;
  }
  const eventName = parsed.event ?? "";
  if (eventName !== "payment.captured" && eventName !== "order.paid") {
    return null;
  }
  const payment = parsed.payload?.payment?.entity;
  const order = parsed.payload?.order?.entity;
  const paymentId = typeof payment?.id === "string" ? payment.id : "";
  const gatewayOrderId =
    (typeof payment?.order_id === "string" && payment.order_id) ||
    (typeof order?.id === "string" && order.id) ||
    "";
  const amountPaise = Number(payment?.amount ?? order?.amount ?? 0);
  const currency = String(payment?.currency ?? order?.currency ?? INR_CURRENCY);
  const notes = asStringNotes(payment?.notes ?? order?.notes);
  if (!gatewayOrderId || !Number.isInteger(amountPaise) || amountPaise < 1) {
    return null;
  }
  const providerEventId =
    eventIdHeader?.trim() ||
    (paymentId ? `${eventName}:${paymentId}` : `${eventName}:${gatewayOrderId}`);
  return {
    providerEventId,
    paymentId: paymentId || gatewayOrderId,
    gatewayOrderId,
    amountPaise,
    currency,
    meta: fromGatewayNotes(notes),
    payload: parsed,
  };
}

export function razorpayKindFromMeta(meta: PaymentMeta | null): PaymentKind | null {
  return meta?.kind ?? null;
}
