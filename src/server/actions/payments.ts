"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { PaymentError } from "@/lib/payments/gateway";
import type { RazorpayClientCheckout } from "@/lib/payments/types";
import {
  buyWebinarPackSchema,
  confirmRazorpaySchema,
  startBookingPaymentSchema,
  startOrderPaymentSchema,
} from "@/lib/validators/payments";
import {
  confirmRazorpayClientPayment,
  startBookingCheckout,
  startOrderCheckout,
  startPlanPackCheckout,
} from "@/server/payments";
import { requireActiveUser } from "@/server/rbac";

export type PaymentActionState = {
  ok?: boolean;
  error?: string;
  razorpay?: RazorpayClientCheckout;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function paymentActionError(error: unknown): PaymentActionState {
  if (error instanceof PaymentError) return { error: error.message };
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return { error: "Please log in to continue." };
    }
    if (error.message === "FORBIDDEN") {
      return { error: "Only verified members can pay." };
    }
  }
  logger.error({ err: error }, "payment action failed");
  return { error: "Unable to start checkout." };
}

function checkoutUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

function finishCheckout(
  start: Awaited<ReturnType<typeof startOrderCheckout>>,
): PaymentActionState {
  if (start.gateway === "stripe") {
    redirect(start.redirectUrl);
  }
  return { ok: true, razorpay: start.razorpay };
}

export async function startOrderPayment(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  let start: Awaited<ReturnType<typeof startOrderCheckout>>;
  try {
    const user = await requireActiveUser();
    const parsed = startOrderPaymentSchema.safeParse({
      orderId: String(formData.get("orderId") ?? ""),
      gateway: String(formData.get("gateway") ?? "razorpay"),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };
    start = await startOrderCheckout({
      orderId: parsed.data.orderId,
      user: checkoutUser(user),
      gateway: parsed.data.gateway,
    });
  } catch (error) {
    return paymentActionError(error);
  }
  return finishCheckout(start);
}

export async function startBookingPayment(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  let start: Awaited<ReturnType<typeof startBookingCheckout>>;
  try {
    const user = await requireActiveUser();
    const parsed = startBookingPaymentSchema.safeParse({
      bookingId: String(formData.get("bookingId") ?? ""),
      gateway: String(formData.get("gateway") ?? "razorpay"),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };
    start = await startBookingCheckout({
      bookingId: parsed.data.bookingId,
      user: checkoutUser(user),
      gateway: parsed.data.gateway,
    });
  } catch (error) {
    return paymentActionError(error);
  }
  return finishCheckout(start);
}

export async function buyWebinarPack(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  let start: Awaited<ReturnType<typeof startPlanPackCheckout>>;
  try {
    const user = await requireActiveUser();
    const parsed = buyWebinarPackSchema.safeParse({
      gateway: String(formData.get("gateway") ?? "razorpay"),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };
    start = await startPlanPackCheckout({
      user: checkoutUser(user),
      gateway: parsed.data.gateway,
    });
  } catch (error) {
    return paymentActionError(error);
  }
  return finishCheckout(start);
}

export async function confirmRazorpayPayment(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  let returnPath = "/account";
  try {
    await requireActiveUser();
    const parsed = confirmRazorpaySchema.safeParse({
      razorpay_order_id: String(formData.get("razorpay_order_id") ?? ""),
      razorpay_payment_id: String(formData.get("razorpay_payment_id") ?? ""),
      razorpay_signature: String(formData.get("razorpay_signature") ?? ""),
      returnPath: String(formData.get("returnPath") ?? "/account"),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };
    returnPath = parsed.data.returnPath;
    await confirmRazorpayClientPayment({
      orderId: parsed.data.razorpay_order_id,
      paymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
  } catch (error) {
    return paymentActionError(error);
  }
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}paid=1`);
}
