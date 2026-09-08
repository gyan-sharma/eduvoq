import { z } from "zod";

export const checkoutGatewaySchema = z
  .enum(["razorpay", "stripe"])
  .optional()
  .transform((value) => (value === "stripe" ? "stripe" : "razorpay"));

export const startOrderPaymentSchema = z.object({
  orderId: z.string().min(1),
  gateway: checkoutGatewaySchema,
});

export const startBookingPaymentSchema = z.object({
  bookingId: z.string().min(1),
  gateway: checkoutGatewaySchema,
});

export const buyWebinarPackSchema = z.object({
  gateway: checkoutGatewaySchema,
});

export const confirmRazorpaySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  returnPath: z
    .string()
    .trim()
    .max(512)
    .optional()
    .transform((value) => {
      if (!value) return "/account";
      if (!value.startsWith("/") || value.startsWith("//")) return "/account";
      return value;
    }),
});
