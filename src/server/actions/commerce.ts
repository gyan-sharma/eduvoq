"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProductType, type Address } from "@prisma/client";
import { INDIA_COUNTRY } from "@/lib/india";
import { logger } from "@/lib/logger";
import { MAX_CART_QTY } from "@/lib/types/commerce";
import {
  addToCartSchema,
  cancelOrderSchema,
  deleteAddressSchema,
  placeOrderSchema,
  saveAddressSchema,
  updateCartSchema,
} from "@/lib/validators/commerce";
import {
  CommerceError,
  catalogWhere,
  cancelPendingOrderForUser,
  getOrCreateCart,
  placeOrderInTransaction,
  releaseExpiredPendingOrders,
} from "@/server/commerce";
import { prisma } from "@/server/db";
import { isFlagEnabled } from "@/server/flags";
import { requireActiveUser } from "@/server/rbac";

export type CommerceActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
} | null;

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function actionError(error: unknown): CommerceActionState {
  if (error instanceof CommerceError) return { error: error.message };
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return { error: "Please log in to continue." };
    }
    if (error.message === "FORBIDDEN") {
      return {
        error: "Only verified members can use the cart and checkout.",
      };
    }
  }
  logger.error({ err: error }, "commerce action failed");
  return { error: "Unable to complete this request." };
}

function revalidateCommerce(): void {
  revalidatePath("/store");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath("/account/addresses");
}

function formNumber(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").trim();
  return Number(raw);
}

function emptyToUndef(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function requireCommerce(): Promise<void> {
  if (!(await isFlagEnabled("commerce"))) {
    throw new CommerceError("The store is temporarily unavailable.");
  }
}

export async function addToCart(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  try {
    await requireCommerce();
    const user = await requireActiveUser();
    const parsed = addToCartSchema.safeParse({
      productId: String(formData.get("productId") ?? ""),
      qty: formNumber(formData.get("qty") ?? "1"),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    await releaseExpiredPendingOrders();

    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, ...catalogWhere },
    });
    if (!product) return { error: "That product is not available." };
    if (product.type === ProductType.PHYSICAL) {
      const physical = await isFlagEnabled("commerce_physical");
      if (!physical) {
        return { error: "Physical shipping is paused." };
      }
    }
    if (product.stock === 0) return { error: `${product.name} is out of stock.` };

    const cart = await getOrCreateCart(user.id);
    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId: product.id },
      },
    });
    const nextQty = (existing?.qty ?? 0) + parsed.data.qty;
    if (product.stock != null && nextQty > product.stock) {
      return { error: `Only ${product.stock} left of ${product.name}.` };
    }
    if (nextQty > MAX_CART_QTY) {
      return { error: `Maximum ${MAX_CART_QTY} per item.` };
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: cart.id, productId: product.id },
      },
      update: { qty: nextQty },
      create: { cartId: cart.id, productId: product.id, qty: parsed.data.qty },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidateCommerce();
  redirect("/cart");
}

export async function updateCart(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  try {
    await requireCommerce();
    const user = await requireActiveUser();
    const remove = String(formData.get("intent") ?? "") === "remove";
    const parsed = updateCartSchema.safeParse({
      productId: String(formData.get("productId") ?? ""),
      qty: remove ? 0 : formNumber(formData.get("qty")),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (!cart) return { error: "Your cart is empty." };

    if (parsed.data.qty === 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId: parsed.data.productId },
      });
      revalidateCommerce();
      return { ok: true, message: "Removed from cart." };
    }

    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, ...catalogWhere },
    });
    if (!product) return { error: "That product is not available." };
    if (product.stock != null && parsed.data.qty > product.stock) {
      return { error: `Only ${product.stock} left of ${product.name}.` };
    }

    await prisma.cartItem.updateMany({
      where: { cartId: cart.id, productId: product.id },
      data: { qty: parsed.data.qty },
    });
    revalidateCommerce();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveAddress(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  try {
    const user = await requireActiveUser();
    const parsed = saveAddressSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      line1: String(formData.get("line1") ?? ""),
      line2: emptyToUndef(String(formData.get("line2") ?? "")),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
      country: String(formData.get("country") ?? INDIA_COUNTRY),
      phone: emptyToUndef(String(formData.get("phone") ?? "")),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    const addressId = emptyToUndef(String(formData.get("addressId") ?? ""));
    const data = {
      name: parsed.data.name,
      line1: parsed.data.line1,
      line2: parsed.data.line2 ?? null,
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: parsed.data.postalCode,
      country: INDIA_COUNTRY,
      phone: parsed.data.phone ?? null,
    };

    if (addressId) {
      const used = await prisma.order.count({
        where: { shippingAddressId: addressId, userId: user.id },
      });
      if (used > 0) {
        return {
          error:
            "This address is used on an order and cannot be edited. Add a new address instead.",
        };
      }
      const updated = await prisma.address.updateMany({
        where: { id: addressId, userId: user.id },
        data,
      });
      if (updated.count !== 1) return { error: "Address not found." };
    } else {
      await prisma.address.create({ data: { ...data, userId: user.id } });
    }
    revalidateCommerce();
    return { ok: true, message: "Address saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAddress(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  try {
    const user = await requireActiveUser();
    const parsed = deleteAddressSchema.safeParse({
      addressId: String(formData.get("addressId") ?? ""),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    const used = await prisma.order.count({
      where: { shippingAddressId: parsed.data.addressId, userId: user.id },
    });
    if (used > 0) {
      return {
        error: "This address is used on an order and cannot be deleted.",
      };
    }

    const deleted = await prisma.address.deleteMany({
      where: { id: parsed.data.addressId, userId: user.id },
    });
    if (deleted.count !== 1) return { error: "Address not found." };
    revalidateCommerce();
    return { ok: true, message: "Address removed." };
  } catch (error) {
    return actionError(error);
  }
}

async function resolveCheckoutAddress(
  userId: string,
  parsed: {
    addressId?: string;
    address?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
    };
  },
): Promise<Address> {
  if (parsed.addressId) {
    const existing = await prisma.address.findFirst({
      where: { id: parsed.addressId, userId },
    });
    if (!existing) throw new CommerceError("Choose a saved India address.");
    if (existing.country !== INDIA_COUNTRY) {
      throw new CommerceError("We ship only within India.");
    }
    return existing;
  }
  const input = parsed.address;
  if (!input) throw new CommerceError("Enter an India shipping address.");
  return prisma.address.create({
    data: {
      userId,
      name: input.name,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: INDIA_COUNTRY,
      phone: input.phone ?? null,
    },
  });
}

export async function placeOrder(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  let orderId: string | null = null;
  try {
    await requireCommerce();
    const user = await requireActiveUser();
    const addressId = emptyToUndef(String(formData.get("addressId") ?? ""));
    const parsed = placeOrderSchema.safeParse({
      addressId,
      address: addressId
        ? undefined
        : {
            name: String(formData.get("name") ?? ""),
            line1: String(formData.get("line1") ?? ""),
            line2: emptyToUndef(String(formData.get("line2") ?? "")),
            city: String(formData.get("city") ?? ""),
            state: String(formData.get("state") ?? ""),
            postalCode: String(formData.get("postalCode") ?? ""),
            country: String(formData.get("country") ?? INDIA_COUNTRY),
            phone: emptyToUndef(String(formData.get("phone") ?? "")),
          },
      buyerGstin: emptyToUndef(String(formData.get("buyerGstin") ?? "")),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };

    await releaseExpiredPendingOrders();
    const physicalEnabled = await isFlagEnabled("commerce_physical");
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: { select: { type: true } } } } },
    });
    const hasPhysical = Boolean(
      cart?.items.some((item) => item.product.type === ProductType.PHYSICAL),
    );
    if (hasPhysical && !parsed.data.addressId && !parsed.data.address) {
      return { error: "Choose a saved address or enter a new India address." };
    }
    const address = hasPhysical
      ? await resolveCheckoutAddress(user.id, parsed.data)
      : null;
    const order = await placeOrderInTransaction({
      userId: user.id,
      address,
      buyerGstin: parsed.data.buyerGstin ?? null,
      physicalEnabled,
    });
    orderId = order.id;
  } catch (error) {
    return actionError(error);
  }

  revalidateCommerce();
  redirect(`/account/orders/${orderId}?placed=1`);
}

export async function cancelPendingOrder(
  _prev: CommerceActionState,
  formData: FormData,
): Promise<CommerceActionState> {
  try {
    const user = await requireActiveUser();
    const parsed = cancelOrderSchema.safeParse({
      orderId: String(formData.get("orderId") ?? ""),
    });
    if (!parsed.success) return { error: firstZodError(parsed.error) };
    await cancelPendingOrderForUser(parsed.data.orderId, user.id);
    revalidateCommerce();
    revalidatePath(`/account/orders/${parsed.data.orderId}`);
    return { ok: true, message: "Order cancelled. Stock has been released." };
  } catch (error) {
    return actionError(error);
  }
}
