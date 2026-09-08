import { z } from "zod";
import {
  GSTIN_RE,
  INDIAN_PIN_RE,
  INDIAN_STATES,
  INDIA_COUNTRY,
  isIndiaCountry,
  normalizeIndianPhone,
} from "@/lib/india";
import { checkoutGatewaySchema } from "@/lib/validators/payments";
import { MAX_CART_QTY } from "@/lib/types/commerce";

const stateSet = new Set<string>(INDIAN_STATES);

export const qtySchema = z
  .number()
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(MAX_CART_QTY, `Maximum ${MAX_CART_QTY} per item.`);

export const addToCartSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  qty: qtySchema,
});

export const updateCartSchema = z.object({
  productId: z.string().min(1),
  qty: z
    .number()
    .int("Quantity must be a whole number.")
    .min(0, "Quantity cannot be negative.")
    .max(MAX_CART_QTY, `Maximum ${MAX_CART_QTY} per item.`),
});

export const addressSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(191),
  line1: z.string().trim().min(1, "Address line 1 is required.").max(191),
  line2: z.string().trim().max(191).optional(),
  city: z.string().trim().min(1, "City is required.").max(96),
  state: z
    .string()
    .trim()
    .refine((value) => stateSet.has(value), "Select an Indian state or UT."),
  postalCode: z
    .string()
    .trim()
    .regex(INDIAN_PIN_RE, "Enter a 6-digit Indian PIN code."),
  country: z
    .string()
    .trim()
    .refine(isIndiaCountry, "We ship only within India."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const normalized = normalizeIndianPhone(value);
      return normalized ?? value;
    })
    .refine(
      (value) => value === undefined || normalizeIndianPhone(value) !== null,
      "Enter a 10-digit Indian mobile number.",
    ),
});

export const saveAddressSchema = addressSchema;

export const deleteAddressSchema = z.object({
  addressId: z.string().min(1),
});

export const placeOrderSchema = z.object({
  addressId: z.string().min(1).optional(),
  address: addressSchema.optional(),
  buyerGstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine(
      (value) => !value || GSTIN_RE.test(value),
      "Enter a valid 15-character GSTIN.",
    ),
  gateway: checkoutGatewaySchema,
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
});

export const defaultIndiaCountry = INDIA_COUNTRY;
