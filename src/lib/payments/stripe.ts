import Stripe from "stripe";
import { stripeCheckoutReady, stripeConfig, stripeWebhookReady } from "@/lib/payments/config";
import {
  INR_CURRENCY,
  PaymentError,
  captureEventId,
  fromGatewayNotes,
  inrPaise,
  stripeCheckoutExpiresAt,
  toGatewayNotes,
  type PaymentMeta,
} from "@/lib/payments/gateway";

function appBase(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

let stripeClient: Stripe | null = null;
let stripeKey = "";

export function getStripe(): Stripe {
  const config = stripeConfig();
  if (!stripeCheckoutReady(config)) {
    throw new PaymentError("International card payments (Stripe) are not configured.");
  }
  if (!stripeClient || stripeKey !== config.secretKey) {
    stripeClient = new Stripe(config.secretKey);
    stripeKey = config.secretKey;
  }
  return stripeClient;
}

export type StripeCapture = {
  providerEventId: string;
  paymentId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  meta: PaymentMeta | null;
  payload: Record<string, unknown>;
};

export async function createStripeCheckoutSession(args: {
  amountPaise: number;
  description: string;
  meta: PaymentMeta;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}): Promise<{ id: string; url: string; paymentIntentId: string | null }> {
  const money = inrPaise(args.amountPaise);
  const stripe = getStripe();
  // Stripe Checkout will not expire sooner than 30 minutes; cron expires the
  // session at the 15-minute local hold so the two clocks match.
  const expiresAt = Math.floor(stripeCheckoutExpiresAt().getTime() / 1000);
  // One-time payment only. Do not call stripe.subscriptions or Billing APIs.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    customer_email: args.customerEmail || undefined,
    expires_at: expiresAt,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: money.currency.toLowerCase(),
          unit_amount: money.amount,
          product_data: { name: args.description },
        },
      },
    ],
    metadata: toGatewayNotes(args.meta),
    payment_intent_data: {
      metadata: toGatewayNotes(args.meta),
    },
  });
  if (!session.url) {
    throw new PaymentError("Stripe did not return a checkout URL.");
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  return { id: session.id, url: session.url, paymentIntentId };
}

export type StripeSessionView = {
  id: string;
  url: string | null;
  status: string | null;
  paymentStatus: string | null;
  paymentIntentId: string | null;
};

export async function retrieveStripeCheckoutSession(
  sessionId: string,
): Promise<StripeSessionView | null> {
  if (!sessionId.startsWith("cs_")) return null;
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  return {
    id: session.id,
    url: session.url,
    status: session.status,
    paymentStatus: session.payment_status,
    paymentIntentId,
  };
}

export function stripeSessionIsOpen(session: StripeSessionView): boolean {
  return session.status === "open";
}

export function stripeSessionIsPaid(session: StripeSessionView): boolean {
  return session.paymentStatus === "paid" || session.status === "complete";
}

export async function expireStripeCheckoutSession(sessionId: string): Promise<void> {
  if (!sessionId.startsWith("cs_")) return;
  const session = await retrieveStripeCheckoutSession(sessionId);
  if (!session || !stripeSessionIsOpen(session)) return;
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch {
    // Completing between retrieve and expire is fine — caller re-inspects.
  }
}

export async function refundStripePayment(paymentId: string): Promise<boolean> {
  if (!paymentId.startsWith("pi_") && !paymentId.startsWith("ch_")) return false;
  try {
    await getStripe().refunds.create(
      paymentId.startsWith("pi_")
        ? { payment_intent: paymentId }
        : { charge: paymentId },
      { idempotencyKey: `eduvoq-conflict-${paymentId}` },
    );
    return true;
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeError &&
      error.statusCode === 400
    ) {
      return true;
    }
    throw error;
  }
}

export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const config = stripeConfig();
  if (!stripeWebhookReady(config) || !signature) {
    throw new PaymentError("Stripe webhook is not configured.");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, config.webhookSecret);
}

export function parseStripeCheckoutSession(
  event: Stripe.Event,
): StripeCapture | null {
  if (event.type !== "checkout.session.completed") return null;
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment") return null;
  if (session.payment_status && session.payment_status !== "paid") return null;
  const amountPaise = session.amount_total ?? 0;
  const currency = (session.currency ?? INR_CURRENCY).toUpperCase();
  const paymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;
  const meta = fromGatewayNotes(session.metadata);
  return {
    providerEventId: captureEventId(paymentId, event.id),
    paymentId,
    gatewayOrderId: session.id,
    amountPaise,
    currency,
    meta,
    payload: event as unknown as Record<string, unknown>,
  };
}

export function stripeSuccessUrl(path: string): string {
  const url = new URL(path, `${appBase().replace(/\/$/, "")}/`);
  return `${url.toString()}${url.search ? "&" : "?"}paid=1`;
}

export function stripeCancelUrl(path: string): string {
  const url = new URL(path, `${appBase().replace(/\/$/, "")}/`);
  return `${url.toString()}${url.search ? "&" : "?"}cancelled=1`;
}
