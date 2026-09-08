import {
  BookingStatus,
  NotificationType,
  OrderStatus,
  PaymentKind,
  PaymentProvider,
  Prisma,
  ProductType,
  SubscriptionStatus,
} from "@prisma/client";
import { sendBookingConfirmedEmail } from "@/lib/email";
import { formatKolkata } from "@/lib/kolkata";
import { logger } from "@/lib/logger";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  razorpayCheckoutReady,
  razorpayConfig,
  stripeCheckoutReady,
} from "@/lib/payments/config";
import {
  INR_CURRENCY,
  PAYMENT_HOLD_MS,
  PaymentError,
  WEBINAR_PLAN_SLUG,
  addUtcMonths,
  formatInvoiceNumber,
  fromGatewayNotes,
  gatewayToProvider,
  invoiceYear,
  parseCheckoutGateway,
  type CheckoutGateway,
  type PaymentMeta,
} from "@/lib/payments/gateway";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  parseRazorpayWebhook,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  constructStripeEvent,
  createStripeCheckoutSession,
  parseStripeCheckoutSession,
  stripeCancelUrl,
  stripeSuccessUrl,
} from "@/lib/payments/stripe";
import type { CheckoutStart } from "@/lib/payments/types";
import { prisma } from "@/server/db";

export type CaptureInput = {
  provider: PaymentProvider;
  providerEventId: string;
  kind: PaymentKind;
  userId?: string | null;
  orderId?: string | null;
  bookingId?: string | null;
  planId?: string | null;
  paymentId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  payload: Prisma.InputJsonValue;
};

export type IngestResult = "duplicate" | "fulfilled" | "ignored";

type CheckoutUser = {
  id: string;
  email: string;
  name: string | null;
};

function requireGateway(gateway: CheckoutGateway): void {
  if (gateway === "stripe") {
    if (!stripeCheckoutReady()) {
      throw new PaymentError("International card payments (Stripe) are not configured.");
    }
    return;
  }
  if (!razorpayCheckoutReady()) {
    throw new PaymentError("India payments (Razorpay) are not configured.");
  }
}

function receiptFor(prefix: string, id: string): string {
  return `${prefix}_${id}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = invoiceYear(now);
  const prefix = `EV-${year}-`;
  const last = await tx.order.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last?.invoiceNumber
    ? Number(last.invoiceNumber.slice(prefix.length)) + 1
    : 1;
  if (!Number.isInteger(seq) || seq < 1) {
    throw new PaymentError("Could not allocate an invoice number.");
  }
  return formatInvoiceNumber(year, seq);
}

async function persistGatewayIds(args: {
  kind: PaymentKind;
  orderId?: string;
  bookingId?: string;
  gatewayOrderId: string;
  paymentId?: string | null;
}): Promise<void> {
  if (args.kind === PaymentKind.ORDER && args.orderId) {
    await prisma.order.updateMany({
      where: { id: args.orderId },
      data: {
        razorpayOrderId: args.gatewayOrderId,
        ...(args.paymentId ? { razorpayPaymentId: args.paymentId } : {}),
      },
    });
  }
  if (args.kind === PaymentKind.BOOKING && args.bookingId) {
    await prisma.booking.updateMany({
      where: { id: args.bookingId },
      data: { razorpayOrderId: args.gatewayOrderId },
    });
  }
}

async function startGatewayCheckout(args: {
  gateway: CheckoutGateway;
  amountPaise: number;
  description: string;
  meta: PaymentMeta;
  receipt: string;
  successPath: string;
  cancelPath: string;
  user: CheckoutUser;
}): Promise<CheckoutStart> {
  requireGateway(args.gateway);
  const moneyCurrency = INR_CURRENCY;

  if (args.gateway === "stripe") {
    const session = await createStripeCheckoutSession({
      amountPaise: args.amountPaise,
      description: args.description,
      meta: args.meta,
      successUrl: stripeSuccessUrl(args.successPath),
      cancelUrl: stripeCancelUrl(args.cancelPath),
      customerEmail: args.user.email,
    });
    await persistGatewayIds({
      kind: args.meta.kind,
      orderId: args.meta.orderId,
      bookingId: args.meta.bookingId,
      gatewayOrderId: session.id,
      paymentId: session.paymentIntentId,
    });
    return { gateway: "stripe", redirectUrl: session.url };
  }

  const order = await createRazorpayOrder({
    amountPaise: args.amountPaise,
    receipt: args.receipt,
    meta: args.meta,
  });
  await persistGatewayIds({
    kind: args.meta.kind,
    orderId: args.meta.orderId,
    bookingId: args.meta.bookingId,
    gatewayOrderId: order.id,
  });
  const config = razorpayConfig();
  return {
    gateway: "razorpay",
    razorpay: {
      keyId: config.keyId,
      orderId: order.id,
      amountPaise: args.amountPaise,
      currency: moneyCurrency,
      name: "EduVoq",
      description: args.description,
      prefillName: args.user.name ?? undefined,
      prefillEmail: args.user.email,
      successPath: args.successPath,
    },
  };
}

export async function startOrderCheckout(args: {
  orderId: string;
  user: CheckoutUser;
  gateway: CheckoutGateway;
}): Promise<CheckoutStart> {
  const order = await prisma.order.findFirst({
    where: { id: args.orderId, userId: args.user.id },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!order) throw new PaymentError("Order not found.");
  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    throw new PaymentError("This order is not awaiting payment.");
  }
  if (order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
    throw new PaymentError("This order expired. Place a new order from your cart.");
  }
  const description =
    order.items.length === 1
      ? order.items[0].product.name
      : `EduVoq order (${order.items.length} items)`;
  return startGatewayCheckout({
    gateway: args.gateway,
    amountPaise: order.totalPaise,
    description,
    receipt: receiptFor("o", order.id),
    successPath: `/account/orders/${order.id}`,
    cancelPath: `/account/orders/${order.id}`,
    user: args.user,
    meta: {
      kind: PaymentKind.ORDER,
      userId: args.user.id,
      orderId: order.id,
    },
  });
}

export async function startBookingCheckout(args: {
  bookingId: string;
  user: CheckoutUser;
  gateway: CheckoutGateway;
}): Promise<CheckoutStart> {
  const booking = await prisma.booking.findFirst({
    where: { id: args.bookingId, customerId: args.user.id },
    include: { service: { select: { title: true, pricePaise: true } } },
  });
  if (!booking) throw new PaymentError("Booking not found.");
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    throw new PaymentError("This booking is not awaiting payment.");
  }
  if (booking.createdAt.getTime() + PAYMENT_HOLD_MS <= Date.now()) {
    throw new PaymentError("This booking hold expired. Pick another slot.");
  }
  if (booking.service.pricePaise < 1) {
    throw new PaymentError("This consultation is not payable.");
  }
  return startGatewayCheckout({
    gateway: args.gateway,
    amountPaise: booking.service.pricePaise,
    description: booking.service.title,
    receipt: receiptFor("b", booking.id),
    successPath: `/account/bookings`,
    cancelPath: `/account/bookings`,
    user: args.user,
    meta: {
      kind: PaymentKind.BOOKING,
      userId: args.user.id,
      bookingId: booking.id,
    },
  });
}

export async function startPlanPackCheckout(args: {
  user: CheckoutUser;
  gateway: CheckoutGateway;
  planSlug?: string;
}): Promise<CheckoutStart> {
  const plan = await prisma.plan.findUnique({
    where: { slug: args.planSlug ?? WEBINAR_PLAN_SLUG },
  });
  if (!plan || plan.pricePaise < 1) {
    throw new PaymentError("That pack is not available.");
  }
  const active = await prisma.subscription.findFirst({
    where: {
      userId: args.user.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { gt: new Date() },
    },
    select: { id: true },
  });
  if (active) {
    throw new PaymentError("You already have an active webinar pack.");
  }
  return startGatewayCheckout({
    gateway: args.gateway,
    amountPaise: plan.pricePaise,
    description: plan.name,
    receipt: receiptFor("p", `${args.user.id}${plan.id}`.slice(-24)),
    successPath: "/account/subscriptions",
    cancelPath: "/pricing",
    user: args.user,
    meta: {
      kind: PaymentKind.PLAN_PACK,
      userId: args.user.id,
      planId: plan.id,
    },
  });
}

async function restoreStockIfNeeded(
  tx: Prisma.TransactionClient,
  items: Array<{ productId: string; qty: number }>,
  direction: "decrement" | "noop",
): Promise<boolean> {
  if (direction !== "decrement") return true;
  const productIds = [...new Set(items.map((item) => item.productId))].sort();
  if (productIds.length > 0) {
    await tx.$queryRaw`
      SELECT id FROM Product WHERE id IN (${Prisma.join(productIds)}) FOR UPDATE
    `;
  }
  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true },
    });
    if (product?.stock == null) continue;
    const updated = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.qty } },
      data: { stock: { decrement: item.qty } },
    });
    if (updated.count !== 1) return false;
  }
  return true;
}

async function fulfillOrder(capture: CaptureInput): Promise<boolean> {
  if (!capture.orderId) return false;
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: capture.orderId! },
      include: { items: { include: { product: { select: { type: true } } } } },
    });
    if (!order) return false;
    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.FULFILLING ||
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      return true;
    }
    if (order.status === OrderStatus.REFUNDED) return false;
    if (order.totalPaise !== capture.amountPaise) {
      throw new PaymentError("Paid amount does not match the order total.");
    }
    if (capture.currency.toUpperCase() !== INR_CURRENCY) {
      throw new PaymentError("Paid currency must be INR.");
    }

    const wasCancelled = order.status === OrderStatus.CANCELLED;
    if (wasCancelled) {
      const ok = await restoreStockIfNeeded(tx, order.items, "decrement");
      if (!ok) {
        logger.error(
          { orderId: order.id, providerEventId: capture.providerEventId },
          "paid cancelled order cannot be revived; stock missing",
        );
        return false;
      }
    } else if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return false;
    }

    const hasPhysical = order.items.some(
      (item) => item.product.type === ProductType.PHYSICAL,
    );
    let invoiceNumber = order.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await nextInvoiceNumber(tx);
    }
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: hasPhysical ? OrderStatus.FULFILLING : OrderStatus.PAID,
        invoiceNumber,
        razorpayOrderId: capture.gatewayOrderId,
        razorpayPaymentId: capture.paymentId,
      },
    });
    await tx.notification.create({
      data: {
        userId: order.userId,
        type: NotificationType.ORDER,
        title: "Payment received",
        body: `Invoice ${invoiceNumber} is confirmed.`,
        href: `/account/orders/${order.id}`,
      },
    });
    return true;
  });
}

async function fulfillBooking(capture: CaptureInput): Promise<boolean> {
  if (!capture.bookingId) return false;
  const booking = await prisma.booking.findUnique({
    where: { id: capture.bookingId },
    include: {
      service: { select: { title: true, pricePaise: true } },
      customer: { select: { email: true, name: true } },
      expert: { select: { name: true } },
    },
  });
  if (!booking) return false;
  if (booking.status === BookingStatus.CONFIRMED) return true;
  if (booking.status !== BookingStatus.PENDING_PAYMENT) return false;
  if (booking.service.pricePaise !== capture.amountPaise) {
    throw new PaymentError("Paid amount does not match the booking total.");
  }
  if (capture.currency.toUpperCase() !== INR_CURRENCY) {
    throw new PaymentError("Paid currency must be INR.");
  }
  const updated = await prisma.booking.updateMany({
    where: { id: capture.bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      razorpayOrderId: capture.gatewayOrderId,
    },
  });
  if (updated.count !== 1) {
    const existing = await prisma.booking.findUnique({
      where: { id: capture.bookingId },
      select: { status: true },
    });
    return existing?.status === BookingStatus.CONFIRMED;
  }
  await prisma.notification.create({
    data: {
      userId: booking.customerId,
      type: NotificationType.BOOKING,
      title: "Consultation confirmed",
      body: `${booking.service.title} is paid and confirmed.`,
      href: "/account/bookings",
    },
  });
  if (booking.customer.email) {
    await sendBookingConfirmedEmail({
      to: booking.customer.email,
      title: booking.service.title,
      whenLabel: formatKolkata(booking.startsAt),
      meetingUrl: booking.meetingUrl,
      expertName: booking.expert.name,
    });
  }
  return true;
}

async function fulfillPlanPack(capture: CaptureInput): Promise<boolean> {
  const planId = capture.planId;
  const userId = capture.userId;
  if (!planId || !userId) return false;
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return false;
  if (plan.pricePaise !== capture.amountPaise) {
    throw new PaymentError("Paid amount does not match the pack price.");
  }
  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      planId,
      razorpayOrderId: capture.gatewayOrderId,
    },
  });
  if (existing) return true;
  const periodEnd = addUtcMonths(new Date(), plan.durationMonths);
  try {
    await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        razorpayOrderId: capture.gatewayOrderId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }
  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.SYSTEM,
      title: "Webinar pack activated",
      body: `${plan.name} is active until ${periodEnd.toISOString().slice(0, 10)}.`,
      href: "/account/subscriptions",
    },
  });
  return true;
}

export async function ingestCapture(capture: CaptureInput): Promise<IngestResult> {
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: capture.provider,
        providerEventId: capture.providerEventId,
        kind: capture.kind,
        orderId: capture.orderId ?? null,
        bookingId: capture.bookingId ?? null,
        payload: capture.payload,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return "duplicate";
    throw error;
  }

  try {
    let ok = false;
    if (capture.kind === PaymentKind.ORDER) ok = await fulfillOrder(capture);
    else if (capture.kind === PaymentKind.BOOKING) ok = await fulfillBooking(capture);
    else if (capture.kind === PaymentKind.PLAN_PACK) ok = await fulfillPlanPack(capture);

    if (!ok) {
      logger.warn(
        {
          provider: capture.provider,
          providerEventId: capture.providerEventId,
          kind: capture.kind,
        },
        "payment event stored but not fulfilled",
      );
      return "ignored";
    }
    return "fulfilled";
  } catch (error) {
    await prisma.paymentEvent.deleteMany({
      where: {
        provider: capture.provider,
        providerEventId: capture.providerEventId,
      },
    });
    throw error;
  }
}

async function resolveMeta(
  meta: PaymentMeta | null,
  gatewayOrderId: string,
): Promise<PaymentMeta | null> {
  if (meta) return meta;
  const order = await prisma.order.findFirst({
    where: { razorpayOrderId: gatewayOrderId },
    select: { id: true, userId: true },
  });
  if (order) {
    return { kind: PaymentKind.ORDER, userId: order.userId, orderId: order.id };
  }
  const booking = await prisma.booking.findFirst({
    where: { razorpayOrderId: gatewayOrderId },
    select: { id: true, customerId: true },
  });
  if (booking) {
    return {
      kind: PaymentKind.BOOKING,
      userId: booking.customerId,
      bookingId: booking.id,
    };
  }
  return null;
}

export async function ingestRazorpayWebhook(args: {
  rawBody: string;
  signature: string | null;
  eventId: string | null;
}): Promise<{ ok: true; result: IngestResult | "skipped" } | { ok: false; error: string; status: number }> {
  if (!verifyRazorpayWebhookSignature(args.rawBody, args.signature)) {
    return { ok: false, error: "Invalid signature.", status: 400 };
  }
  const capture = parseRazorpayWebhook(args.rawBody, args.eventId);
  if (!capture) return { ok: true, result: "skipped" };
  const meta = await resolveMeta(capture.meta, capture.gatewayOrderId);
  if (!meta) {
    logger.warn({ gatewayOrderId: capture.gatewayOrderId }, "razorpay webhook missing meta");
    return { ok: true, result: "ignored" };
  }
  const result = await ingestCapture({
    provider: PaymentProvider.RAZORPAY,
    providerEventId: capture.providerEventId,
    kind: meta.kind,
    userId: meta.userId,
    orderId: meta.orderId,
    bookingId: meta.bookingId,
    planId: meta.planId,
    paymentId: capture.paymentId,
    gatewayOrderId: capture.gatewayOrderId,
    amountPaise: capture.amountPaise,
    currency: capture.currency,
    payload: JSON.parse(JSON.stringify(capture.payload)) as Prisma.InputJsonValue,
  });
  return { ok: true, result };
}

export async function ingestStripeWebhook(args: {
  rawBody: string;
  signature: string | null;
}): Promise<{ ok: true; result: IngestResult | "skipped" } | { ok: false; error: string; status: number }> {
  let event;
  try {
    event = constructStripeEvent(args.rawBody, args.signature);
  } catch (error) {
    logger.warn({ err: error }, "stripe webhook signature failed");
    return { ok: false, error: "Invalid signature.", status: 400 };
  }
  const capture = parseStripeCheckoutSession(event);
  if (!capture) return { ok: true, result: "skipped" };
  const meta = await resolveMeta(capture.meta, capture.gatewayOrderId);
  if (!meta) {
    logger.warn({ gatewayOrderId: capture.gatewayOrderId }, "stripe webhook missing meta");
    return { ok: true, result: "ignored" };
  }
  const result = await ingestCapture({
    provider: PaymentProvider.STRIPE,
    providerEventId: capture.providerEventId,
    kind: meta.kind,
    userId: meta.userId,
    orderId: meta.orderId,
    bookingId: meta.bookingId,
    planId: meta.planId,
    paymentId: capture.paymentId,
    gatewayOrderId: capture.gatewayOrderId,
    amountPaise: capture.amountPaise,
    currency: capture.currency,
    payload: JSON.parse(JSON.stringify(capture.payload)) as Prisma.InputJsonValue,
  });
  return { ok: true, result };
}

export async function confirmRazorpayClientPayment(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<IngestResult> {
  if (
    !verifyRazorpayCheckoutSignature({
      orderId: args.orderId,
      paymentId: args.paymentId,
      signature: args.signature,
    })
  ) {
    throw new PaymentError("Invalid Razorpay signature.");
  }
  const payment = await fetchRazorpayPayment(args.paymentId);
  if (payment.order_id !== args.orderId) {
    throw new PaymentError("Payment does not match this order.");
  }
  if (payment.status !== "captured" && payment.status !== "authorized") {
    throw new PaymentError("Payment is not captured yet.");
  }
  const meta = await resolveMeta(fromGatewayNotes(payment.notes), args.orderId);
  if (!meta) throw new PaymentError("Unknown Razorpay order.");
  return ingestCapture({
    provider: PaymentProvider.RAZORPAY,
    providerEventId: `checkout:${payment.id}`,
    kind: meta.kind,
    userId: meta.userId,
    orderId: meta.orderId,
    bookingId: meta.bookingId,
    planId: meta.planId,
    paymentId: payment.id,
    gatewayOrderId: payment.order_id,
    amountPaise: payment.amount,
    currency: payment.currency,
    payload: payment as unknown as Prisma.InputJsonValue,
  });
}

export { parseCheckoutGateway, gatewayToProvider, PAYMENT_HOLD_MS };
