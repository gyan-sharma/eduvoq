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
  captureEventId,
  formatInvoiceNumber,
  fromGatewayNotes,
  gatewayKindFromId,
  gatewayToProvider,
  invoiceYear,
  parseCheckoutGateway,
  paymentHoldExpiresAt,
  sameGatewayPaymentId,
  type CheckoutGateway,
  type PaymentMeta,
} from "@/lib/payments/gateway";
import {
  cancelRazorpayOrder,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  parseRazorpayWebhook,
  razorpayOrderIsOpen,
  refundRazorpayPayment,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  constructStripeEvent,
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  parseStripeCheckoutSession,
  refundStripePayment,
  retrieveStripeCheckoutSession,
  stripeCancelUrl,
  stripeSessionIsOpen,
  stripeSessionIsPaid,
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

export type IngestResult = "duplicate" | "fulfilled" | "ignored" | "conflict";

type FulfillStatus = "fulfilled" | "retry" | "conflict";

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
  planId?: string;
  userId?: string;
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
  if (args.kind === PaymentKind.PLAN_PACK && args.planId && args.userId) {
    const pending = await prisma.subscription.findFirst({
      where: {
        userId: args.userId,
        planId: args.planId,
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      await prisma.subscription.update({
        where: { id: pending.id },
        data: {
          razorpayOrderId: args.gatewayOrderId,
          currentPeriodEnd: paymentHoldExpiresAt(),
        },
      });
      return;
    }
    await prisma.subscription.create({
      data: {
        userId: args.userId,
        planId: args.planId,
        status: SubscriptionStatus.CANCELED,
        razorpayOrderId: args.gatewayOrderId,
        currentPeriodEnd: paymentHoldExpiresAt(),
      },
    });
  }
}

async function razorpayCheckoutFromOrder(args: {
  orderId: string;
  amountPaise: number;
  description: string;
  user: CheckoutUser;
  successPath: string;
}): Promise<CheckoutStart> {
  const config = razorpayConfig();
  return {
    gateway: "razorpay",
    razorpay: {
      keyId: config.keyId,
      orderId: args.orderId,
      amountPaise: args.amountPaise,
      currency: INR_CURRENCY,
      name: "EduVoq",
      description: args.description,
      prefillName: args.user.name ?? undefined,
      prefillEmail: args.user.email,
      successPath: args.successPath,
    },
  };
}

async function reuseOpenGateway(args: {
  gateway: CheckoutGateway;
  existingId: string | null;
  amountPaise: number;
  description: string;
  user: CheckoutUser;
  successPath: string;
}): Promise<CheckoutStart | null> {
  if (!args.existingId) return null;
  if (gatewayKindFromId(args.existingId) !== args.gateway) return null;
  try {
    if (args.gateway === "razorpay") {
      const order = await fetchRazorpayOrder(args.existingId);
      if (order.status === "paid") {
        return {
          alreadyPaid: true,
          paymentId: args.existingId,
          returnPath: args.successPath,
        };
      }
      if (razorpayOrderIsOpen(order.status)) {
        return razorpayCheckoutFromOrder({
          orderId: order.id,
          amountPaise: args.amountPaise,
          description: args.description,
          user: args.user,
          successPath: args.successPath,
        });
      }
      return null;
    }
    const session = await retrieveStripeCheckoutSession(args.existingId);
    if (!session) return null;
    if (stripeSessionIsPaid(session)) {
      return {
        alreadyPaid: true,
        paymentId: session.paymentIntentId,
        returnPath: args.successPath,
      };
    }
    if (stripeSessionIsOpen(session) && session.url) {
      return { gateway: "stripe", redirectUrl: session.url };
    }
  } catch (error) {
    logger.warn({ err: error, gatewayId: args.existingId }, "reuse gateway session failed");
  }
  return null;
}

async function retireGatewaySession(existingId: string | null): Promise<void> {
  if (!existingId) return;
  try {
    const kind = gatewayKindFromId(existingId);
    if (kind === "razorpay") await cancelRazorpayOrder(existingId);
    if (kind === "stripe") await expireStripeCheckoutSession(existingId);
  } catch (error) {
    logger.warn({ err: error, gatewayId: existingId }, "retire gateway session failed");
  }
}

export async function allowReleaseExpiredPayment(
  gatewayOrderId: string | null,
): Promise<boolean> {
  if (!gatewayOrderId) return true;
  const kind = gatewayKindFromId(gatewayOrderId);
  try {
    if (kind === "stripe") {
      const session = await retrieveStripeCheckoutSession(gatewayOrderId);
      if (session && stripeSessionIsPaid(session)) return false;
      if (session && stripeSessionIsOpen(session)) {
        await expireStripeCheckoutSession(gatewayOrderId);
        const again = await retrieveStripeCheckoutSession(gatewayOrderId);
        if (again && stripeSessionIsPaid(again)) return false;
      }
      return true;
    }
    if (kind === "razorpay") {
      const order = await fetchRazorpayOrder(gatewayOrderId);
      if (order.status === "paid") return false;
      if (razorpayOrderIsOpen(order.status)) {
        await cancelRazorpayOrder(gatewayOrderId);
      }
      return true;
    }
  } catch (error) {
    logger.warn({ err: error, gatewayOrderId }, "gateway inspect before release failed");
    return false;
  }
  return true;
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
  existingGatewayId?: string | null;
}): Promise<CheckoutStart> {
  requireGateway(args.gateway);
  const reused = await reuseOpenGateway({
    gateway: args.gateway,
    existingId: args.existingGatewayId ?? null,
    amountPaise: args.amountPaise,
    description: args.description,
    user: args.user,
    successPath: args.successPath,
  });
  if (reused) return reused;

  await retireGatewaySession(args.existingGatewayId ?? null);

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
      planId: args.meta.planId,
      userId: args.meta.userId,
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
    planId: args.meta.planId,
    userId: args.meta.userId,
    gatewayOrderId: order.id,
  });
  return razorpayCheckoutFromOrder({
    orderId: order.id,
    amountPaise: args.amountPaise,
    description: args.description,
    user: args.user,
    successPath: args.successPath,
  });
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
  const returnPath = `/account/orders/${order.id}`;
  if (
    order.status === OrderStatus.PAID ||
    order.status === OrderStatus.FULFILLING ||
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED
  ) {
    return {
      alreadyPaid: true,
      paymentId: order.razorpayPaymentId,
      returnPath,
    };
  }
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
    successPath: returnPath,
    cancelPath: returnPath,
    user: args.user,
    existingGatewayId: order.razorpayOrderId,
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
  if (booking.status === BookingStatus.CONFIRMED) {
    return {
      alreadyPaid: true,
      paymentId: booking.razorpayOrderId,
      returnPath: "/account/bookings",
    };
  }
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
    existingGatewayId: booking.razorpayOrderId,
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
    select: { id: true, razorpayOrderId: true },
  });
  if (active) {
    return {
      alreadyPaid: true,
      paymentId: active.razorpayOrderId,
      returnPath: "/account/subscriptions",
    };
  }
  const pending = await prisma.subscription.findFirst({
    where: {
      userId: args.user.id,
      planId: plan.id,
      status: SubscriptionStatus.CANCELED,
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { razorpayOrderId: true },
  });
  return startGatewayCheckout({
    gateway: args.gateway,
    amountPaise: plan.pricePaise,
    description: plan.name,
    receipt: receiptFor("p", `${args.user.id}${plan.id}`.slice(-24)),
    successPath: "/account/subscriptions",
    cancelPath: "/pricing",
    user: args.user,
    existingGatewayId: pending?.razorpayOrderId ?? null,
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

async function fulfillOrder(capture: CaptureInput): Promise<FulfillStatus> {
  if (!capture.orderId) return "retry";
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: capture.orderId! },
      include: { items: { include: { product: { select: { type: true } } } } },
    });
    if (!order) return "retry";
    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.FULFILLING ||
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      return sameGatewayPaymentId(order.razorpayPaymentId, capture.paymentId)
        ? "fulfilled"
        : "conflict";
    }
    if (order.status === OrderStatus.REFUNDED) return "conflict";
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
        return "conflict";
      }
    } else if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return "retry";
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
    return "fulfilled";
  });
}

async function fulfillBooking(capture: CaptureInput): Promise<FulfillStatus> {
  if (!capture.bookingId) return "retry";
  const booking = await prisma.booking.findUnique({
    where: { id: capture.bookingId },
    include: {
      service: { select: { title: true, pricePaise: true } },
      customer: { select: { email: true, name: true } },
      expert: { select: { name: true } },
    },
  });
  if (!booking) return "conflict";
  if (booking.status === BookingStatus.CONFIRMED) {
    return sameGatewayPaymentId(booking.razorpayOrderId, capture.gatewayOrderId)
      ? "fulfilled"
      : "conflict";
  }
  if (
    booking.status !== BookingStatus.PENDING_PAYMENT &&
    booking.status !== BookingStatus.CANCELLED
  ) {
    return "retry";
  }
  if (booking.service.pricePaise !== capture.amountPaise) {
    throw new PaymentError("Paid amount does not match the booking total.");
  }
  if (capture.currency.toUpperCase() !== INR_CURRENCY) {
    throw new PaymentError("Paid currency must be INR.");
  }
  const updated = await prisma.booking.updateMany({
    where: {
      id: capture.bookingId,
      status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CANCELLED] },
    },
    data: {
      status: BookingStatus.CONFIRMED,
      razorpayOrderId: capture.gatewayOrderId,
    },
  });
  if (updated.count !== 1) {
    const existing = await prisma.booking.findUnique({
      where: { id: capture.bookingId },
      select: { status: true, razorpayOrderId: true },
    });
    if (existing?.status === BookingStatus.CONFIRMED) {
      return sameGatewayPaymentId(existing.razorpayOrderId, capture.gatewayOrderId)
        ? "fulfilled"
        : "conflict";
    }
    return "retry";
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
  return "fulfilled";
}

async function fulfillPlanPack(capture: CaptureInput): Promise<FulfillStatus> {
  const planId = capture.planId;
  const userId = capture.userId;
  if (!planId || !userId) return "retry";
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return "retry";
  if (plan.pricePaise !== capture.amountPaise) {
    throw new PaymentError("Paid amount does not match the pack price.");
  }
  if (capture.currency.toUpperCase() !== INR_CURRENCY) {
    throw new PaymentError("Paid currency must be INR.");
  }
  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { gt: new Date() },
    },
  });
  if (active) {
    return sameGatewayPaymentId(active.razorpayOrderId, capture.gatewayOrderId)
      ? "fulfilled"
      : "conflict";
  }
  const periodEnd = addUtcMonths(new Date(), plan.durationMonths);
  const pending = await prisma.subscription.findFirst({
    where: {
      userId,
      planId,
      razorpayOrderId: capture.gatewayOrderId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    await prisma.subscription.update({
      where: { id: pending.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        razorpayOrderId: capture.gatewayOrderId,
      },
    });
  } else {
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
  return "fulfilled";
}

async function refundConflictingCapture(capture: CaptureInput): Promise<boolean> {
  try {
    if (capture.provider === PaymentProvider.STRIPE) {
      return await refundStripePayment(capture.paymentId);
    }
    if (capture.provider === PaymentProvider.RAZORPAY) {
      return await refundRazorpayPayment(capture.paymentId);
    }
    return false;
  } catch (error) {
    logger.error(
      {
        err: error,
        provider: capture.provider,
        paymentId: capture.paymentId,
        providerEventId: capture.providerEventId,
      },
      "double-charge refund failed",
    );
    return false;
  }
}

async function recordPaymentEvent(capture: CaptureInput): Promise<"ok" | "duplicate"> {
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
    return "ok";
  } catch (error) {
    if (isUniqueConstraintError(error)) return "duplicate";
    throw error;
  }
}

export async function ingestCapture(capture: CaptureInput): Promise<IngestResult> {
  let status: FulfillStatus = "retry";
  if (capture.kind === PaymentKind.ORDER) status = await fulfillOrder(capture);
  else if (capture.kind === PaymentKind.BOOKING) status = await fulfillBooking(capture);
  else if (capture.kind === PaymentKind.PLAN_PACK) status = await fulfillPlanPack(capture);

  if (status === "retry") {
    logger.warn(
      {
        provider: capture.provider,
        providerEventId: capture.providerEventId,
        kind: capture.kind,
      },
      "payment capture not fulfilled; leaving PaymentEvent unset for retry",
    );
    return "ignored";
  }

  if (status === "conflict") {
    logger.error(
      {
        provider: capture.provider,
        providerEventId: capture.providerEventId,
        paymentId: capture.paymentId,
        kind: capture.kind,
      },
      "capture conflicts with an already-paid row",
    );
    const refunded = await refundConflictingCapture(capture);
    if (!refunded) {
      logger.warn(
        { providerEventId: capture.providerEventId, paymentId: capture.paymentId },
        "conflict refund not confirmed; leaving PaymentEvent unset for retry",
      );
      return "ignored";
    }
    await recordPaymentEvent(capture);
    return "conflict";
  }

  const recorded = await recordPaymentEvent(capture);
  if (recorded === "duplicate") return "duplicate";
  return "fulfilled";
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
  const pack = await prisma.subscription.findFirst({
    where: { razorpayOrderId: gatewayOrderId },
    select: { userId: true, planId: true },
  });
  if (pack) {
    return {
      kind: PaymentKind.PLAN_PACK,
      userId: pack.userId,
      planId: pack.planId,
    };
  }
  return null;
}

function webhookIngestResponse(
  result: IngestResult,
): { ok: true; result: IngestResult } | { ok: false; error: string; status: number } {
  if (result === "ignored") {
    return { ok: false, error: "Capture not fulfilled.", status: 500 };
  }
  return { ok: true, result };
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
    return { ok: false, error: "Unknown payment.", status: 500 };
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
  return webhookIngestResponse(result);
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
    return { ok: false, error: "Unknown payment.", status: 500 };
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
  return webhookIngestResponse(result);
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
    providerEventId: captureEventId(payment.id, `checkout:${payment.id}`),
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
